// In-memory read versions only. A fresh page is required after a conflict.
var WriteGuard=(function(){
  var rows=new Map();
  function key(sheet,row){return sheet==='출결'?sheet+'|'+String(row['날짜']||'').slice(0,10)+'|'+row['멤버ID']:sheet+'|'+(sheet==='settings'?row.Key:row.ID);}
  return {
    remember:function(params,result){if(params.action==='loadJSON'&&['Assessment','Nutrition'].includes(params.fileType)){var j='JSON|'+params.fileType+'|'+params.memberId;if(!rows.has(j))rows.set(j,result.data.writeToken||null);}if(!params.sheet||!Array.isArray(result.data))return result;result.data.forEach(function(r){var k=key(params.sheet,r);if(!rows.has(k))rows.set(k,r._writeToken||null);});return result;},
    prepare:function(body){if(body.action==='saveJSON'&&['Assessment','Nutrition'].includes(body.fileType)){var j='JSON|'+body.fileType+'|'+body.memberId;return Object.assign({},body,{expectedToken:rows.get(j)||null,_guardKey:j});}if(!body.sheet||!['upsert','update','delete'].includes(body.action)||body.sheet==='PCSP')return body;var r=body.data||{ID:body.id};var k=key(body.sheet,r);return Object.assign({},body,{expectedToken:rows.get(k)||null,_guardKey:k});},
    saved:function(body,result){if(body._guardKey&&result.data&&result.data.success)rows.set(body._guardKey,result.data.writeToken||null);return result;}
  };
})();
