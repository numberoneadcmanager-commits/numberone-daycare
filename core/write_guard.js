// Read tokens are adopted with the displayed data, never by a background re-read.
// All state here is transient. Sheets/Drive remain authoritative.
var WriteGuard=(function(){
  var rows=new Map(),sources=new WeakMap(),edits=new Set(),applied=new Map(),seq=0,epoch=0,writes=0;
  function key(sheet,row){return sheet==='출결'?sheet+'|'+String(row['날짜']||'').slice(0,10)+'|'+row['멤버ID']:sheet+'|'+(sheet==='settings'?row.Key:row.ID);}
  function editing(){return edits.size>0||(typeof document!=='undefined'&&!!document.querySelector('dialog[open]'));}
  function snapshots(value){return value&&typeof value==='object'?(sources.get(value)||[]):[];}
  function track(value){if(value&&typeof value==='object'){var list=[];for(var i=1;i<arguments.length;i++)list=list.concat(snapshots(arguments[i]));sources.set(value,list);}return value;}
  function remember(params,result,stamp){
    if(!result||!result.ok)return result;
    stamp=stamp||{seq:++seq,epoch:epoch};
    if(params.sheet&&Array.isArray(result.data)){
      var snapshot={params:Object.assign({},params),rows:result.data.map(function(r){return Object.assign({},r);}),stamp:stamp};sources.set(result,[snapshot]);sources.set(result.data,[snapshot]);
      // Compatibility for initial loaders. Existing tokens are never replaced here.
      if(!editing()&&stamp.epoch===epoch)result.data.forEach(function(r){var k=key(params.sheet,r);if(!rows.has(k))rows.set(k,r._writeToken||null);});
    }
    if(params.action==='loadJSON'&&['Assessment','Nutrition'].includes(params.fileType)){var j='JSON|'+params.fileType+'|'+params.memberId;if(!editing()&&!rows.has(j))rows.set(j,result.data.writeToken||null);}
    return result;
  }
  function covers(s,k){var p=s.params,prefix=p.sheet+'|';if(p.action==='read')return k.indexOf(prefix)===0;if(p.action==='readByDate'&&p.sheet==='출결')return k.indexOf(prefix+p.date+'|')===0;return s.rows.some(function(r){return key(p.sheet,r)===k;});}
  function adopt(value,commit){
    var list=snapshots(value);
    if(writes)throw new Error('저장 중에는 조회 결과를 바꾸지 않습니다. 저장 후 다시 불러와주세요.');
    if(editing())throw new Error('열려 있는 편집창의 입력을 보존했습니다. 저장하거나 닫은 뒤 새로고침해주세요.');
    list.forEach(function(s){if(s.stamp.epoch!==epoch)throw new Error('조회 중 데이터가 변경되었습니다. 다시 불러와주세요.');applied.forEach(function(n,k){if(covers(s,k)&&s.stamp.seq<n)throw new Error('더 최신 조회 결과가 이미 반영되었습니다. 다시 불러와주세요.');});});
    // Commit only synchronous data assignments; no await or network work in this callback.
    commit();
    list.forEach(function(s){var p=s.params,prefix=p.sheet+'|';
      if(p.action==='read'||p.action==='readByDate')rows.forEach(function(v,k){if(k.indexOf(prefix)===0&&(p.action==='read'||p.sheet==='출결'&&k.indexOf(prefix+p.date+'|')===0)){rows.delete(k);applied.set(k,s.stamp.seq);}});
      s.rows.forEach(function(r){var k=key(p.sheet,r);rows.set(k,r._writeToken||null);applied.set(k,s.stamp.seq);});
    });
    return value;
  }
  return {
    readStart:function(){return {seq:++seq,epoch:epoch};},remember:remember,track:track,adopt:adopt,select:function(result,selected){var list=snapshots(result).map(function(s){return {params:{sheet:s.params.sheet,action:'selected'},rows:selected,stamp:s.stamp};});var value={};sources.set(value,list);return value;},
    beginEdit:function(scope){edits.add(scope);},endEdit:function(scope){edits.delete(scope);},editing:editing,writeStart:function(){writes++;epoch++;},writeEnd:function(){writes=Math.max(0,writes-1);},
    prepare:function(body){
      if(body.action==='saveJSON'&&['Assessment','Nutrition'].includes(body.fileType)){var j='JSON|'+body.fileType+'|'+body.memberId;return Object.assign({},body,{expectedToken:rows.get(j)||null,_guardKey:j});}
      if(!body.sheet||!['upsert','update','delete'].includes(body.action)||body.sheet==='PCSP')return body;
      var r=body.data||{ID:body.id};var k=key(body.sheet,r);return Object.assign({},body,{expectedToken:rows.get(k)||null,_guardKey:k});
    },
    saved:function(body,result){if(body._guardKey&&result.data&&result.data.success){epoch++;rows.set(body._guardKey,result.data.writeToken||null);}return result;}
  };
})();
