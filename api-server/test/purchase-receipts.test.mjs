import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source=readFileSync(new URL('../src/worker.js',import.meta.url),'utf8')
  .replace(/^import .*\n/,'')
  .replace('export default {','globalThis.worker = {');
let lookedUp=false;
const context={
  Request,Response,URL,console,
  verifyPlayGamesPlayer:async code=>{
    if(code!=='valid')throw Error('INVALID_AUTH_CODE');
    return 'p1';
  },
  verifyGooglePurchase:()=>{throw Error('purchase verification should not run');},
  creditVerifiedPurchase:()=>{throw Error('credit must not run');}
};
vm.runInNewContext(source,context);
const env={PURCHASE_API_ENABLED:'true',DB:{prepare(sql){
  assert.match(sql,/WHERE player_id = \? AND credited_at IS NOT NULL/);
  assert.doesNotMatch(sql,/order_id/);
  return {bind(id){
    assert.equal(id,'p1');
    return {async all(){lookedUp=true;return {results:[{id:'hash1',product_id:'pack_inicial',coins:100000,is_test:1,credited_at:'2026-10-03 22:01:00'}]};}};
  }};
}}};
const call=code=>context.worker.fetch(new Request('https://example.com/api/purchases/receipts',{
  method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({auth_code:code})
}),env);
const bad=await call('invalid');
assert.equal(bad.status,503);
assert.equal(lookedUp,false);
const good=await call('valid');
assert.equal(good.status,200);
const data=await good.json();
assert.equal(data.player_id,'p1');
assert.equal(data.receipts.length,1);
assert.equal(data.receipts[0].product_id,'pack_inicial');
assert.equal('order_id' in data.receipts[0],false);

const handlers={};
const element=()=>({
  children:[],style:{},textContent:'',
  replaceChildren(){this.children=[];},
  appendChild(child){this.children.push(child);},
  append(...children){this.children.push(...children);},
  addEventListener(type,fn){this['on'+type]=fn;}
});
const elements=new Map(['inboxScreen','inboxMessages','inboxStatus','inboxUnreadBadge','openInboxBtn','closeInboxBtn']
  .map(id=>[id,element()]));
const saved=new Map();
let pvpReads=0;
const inboxContext={
  window:{
    getPlayGamesPvpSession:async()=>({token:'pvp-token'}),
    requestPlayGamesServerAuthCode:async()=> 'valid',
    GallinaPlayerIdentity:{getCurrent:()=>({id:'p1'})},
    addEventListener(type,fn){handlers[type]=fn;}
  },
  document:{
    getElementById:id=>elements.get(id),
    createElement:()=>element(),
    addEventListener(type,fn){handlers[type]=fn;}
  },
  navigator:{onLine:true},
  localStorage:{getItem:key=>saved.get(key)||null,setItem:(key,value)=>saved.set(key,value)},
  fetch:async url=>{
    if(url.includes('/inbox/read')){pvpReads++;return new Response('{}');}
    if(url.includes('/inbox?'))return new Response(JSON.stringify({ok:true,messages:[],unread:0}));
    if(url.includes('/api/purchases/receipts'))return new Response(JSON.stringify(data));
    throw Error('Unexpected URL '+url);
  },
  setTimeout,console
};
vm.runInNewContext(readFileSync(new URL('../../js/inbox.js',import.meta.url),'utf8'),inboxContext);
await inboxContext.window.gallinaRefreshInbox();
assert.equal(elements.get('inboxUnreadBadge').textContent,'(1)');
await elements.get('openInboxBtn').onclick();
assert.equal(elements.get('inboxMessages').children.length,1);
assert.match(elements.get('inboxMessages').children[0].children[0].textContent,/Compra de prueba · Pack Inicial/);
assert.equal(elements.get('inboxUnreadBadge').textContent,'');
await inboxContext.window.gallinaRefreshInbox();
assert.equal(elements.get('inboxUnreadBadge').textContent,'');
assert.equal(pvpReads,0);
console.log('Receipts require player authentication and remain one inbox message per grant: OK');
