// Unit-test persistence adapter. Tokens minted by these fixtures are explicitly
// registered; production authority still executes its real session SQL. Real
// PostgreSQL suites separately test issuance, unknown credentials and constraints.
const crypto=require('node:crypto'),jwt=require('jsonwebtoken');
const hash=value=>crypto.createHash('sha256').update(value).digest('hex'),rows=new Map(),bound=new WeakSet();let installed=false;
function install(){if(installed)return;installed=true;const sign=jwt.sign;
 jwt.sign=function(payload,secret,options,...rest){
  if(payload&&typeof payload==='object'&&payload.purpose==='admin_step_up'){
   const primary=[...rows.values()].find(row=>row.authorization_hash===payload.session_hash);
   if(primary)payload={...payload,session_hash:hash(JSON.stringify([primary.id,primary.generation,primary.user_epoch]))};
  }
  const sub=payload?.sub||options?.subject,primary=typeof payload==='object'&&sub&&payload.purpose!=='admin_step_up'&&payload.aud!=='wadatrip-admin';
  if(primary)payload={sid:crypto.randomUUID(),sg:1,ue:0,...payload};
  const token=sign.call(this,payload,secret,options,...rest);
  if(primary&&typeof token==='string'){const claims=jwt.decode(token);if(claims.exp)rows.set(hash(token),{id:claims.sid,user_id:sub,credential_hash:hash(token),authorization_hash:hash('Bearer '+token),kind:'native',generation:claims.sg,user_epoch:claims.ue,auth_method:'email_code',authenticated_at:new Date((claims.iat||Date.now()/1000)*1000),email_verified_at:claims.email_verified===true?new Date():null,created_at:new Date(),last_seen_at:new Date(),expires_at:new Date(claims.exp*1000),revoked_at:null});}
  return token;
 };
}
function matches(row,where={}){return Object.entries(where).every(([key,value])=>value&&typeof value==='object'&&'not'in value?row[key]!==value.not:row[key]===value);}
function assign(row,data){for(const[k,v]of Object.entries(data))row[k]=v&&typeof v==='object'&&'increment'in v?(row[k]||0)+v.increment:v;return row;}
function enable(db){install();if(bound.has(db))return db;bound.add(db);const original=db.$queryRaw?.bind(db);
 db.$queryRaw=async(parts,...values)=>{const sql=parts.join('?');
  if(sql.includes('UPDATE "auth_sessions" AS s')){
   const[touch,key,id,generation,userId,epoch]=values,row=rows.get(key);if(!row||row.id!==id||row.generation!==generation||row.user_id!==userId||row.user_epoch!==epoch||row.revoked_at||+row.expires_at<=Date.now())return[];
   const user=await db.users.findUnique({where:{id:userId}});if(!user||user.id!==userId||user.status!=='active'||(user.auth_epoch||0)!==epoch)return[];
   if(touch)row.last_seen_at=new Date();return[{...row,uid:user.id,email:user.email,name:user.name||null,role:user.role,status:user.status,auth_epoch:user.auth_epoch||0}];
  }
  if(sql.includes('clock_timestamp()'))return[{now:new Date()}];
  return original?original(parts,...values):[{id:values[0],locked:1}];
 };
 db.auth_sessions ||= {
  create:async({data})=>{const row={id:crypto.randomUUID(),generation:0,user_epoch:0,...data};rows.set(row.credential_hash||row.flow_hash,row);return row;},
  findUnique:async({where})=>[...rows.values()].find(row=>matches(row,where))||null,
  update:async({where,data})=>{const row=[...rows.values()].find(row=>matches(row,where));if(!row)throw Error('Missing synthetic session');return assign(row,data);},
  updateMany:async({where,data})=>{const selected=[...new Set(rows.values())].filter(row=>matches(row,where));for(const row of selected)assign(row,data);return{count:selected.length};},
 };
 return db;
}
function binding(req){const row=[...rows.values()].find(r=>r.authorization_hash===hash(req.headers.authorization));if(!row)throw Error('Register a synthetic credential before binding MFA');return hash(JSON.stringify([row.id,row.generation,row.user_epoch]));}
module.exports={install,enable,rows,binding};
