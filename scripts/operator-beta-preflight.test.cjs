const{test}=require('node:test'),assert=require('node:assert/strict');
const{checkBetaEnvironment}=require('./operator-beta-preflight.cjs');
const env={OPERATOR_BETA_USER_IDS:'synthetic-one,synthetic-two',OPERATOR_BETA_PREPARATION_ONLY:'true',PAYMENTS_LIVE_ENABLED:'false',PAYMENTS_ACCEPT_NEW:'false',AUTH_RATE_LIMIT_SECRET:'synthetic-auth-secret-for-local-tests',INTERNAL_SERVICE_TOKEN:'synthetic-internal-secret-for-local-tests',ENABLE_OPERATOR_DOCUMENT_UPLOADS:'false',ENABLE_OPERATOR_LEADS:'false',ENABLE_OPERATOR_LEAD_SEARCH:'false',ENABLE_OPERATOR_LEADS_PROXY:'false',ENABLE_WADAGENT_PROXY:'false',ENABLE_COMMUNITY:'false',FF_PROVIDER_HUB:'false'};
test('preparation cohort reports counts without exposing identities or credentials',()=>{const result=checkBetaEnvironment(env);assert.equal(result.pass,true);assert.equal(result.member_count,2);for(const value of ['synthetic-one','synthetic-two','synthetic-only'])assert.equal(JSON.stringify(result).includes(value),false)});
test('unreviewed flags, missing secrets and public cohort fail closed',()=>{for(const changes of [{OPERATOR_BETA_PREPARATION_ONLY:undefined},{PAYMENTS_LIVE_ENABLED:'true'},{ENABLE_OPERATOR_DOCUMENT_UPLOADS:'true'},{ENABLE_OPERATOR_LEADS:'true'},{OPERATOR_BETA_PUBLICATION_USER_IDS:'synthetic-one'},{AUTH_RATE_LIMIT_SECRET:''},{INTERNAL_SERVICE_TOKEN:''},{OPERATOR_BETA_USER_IDS:'*'}])assert.equal(checkBetaEnvironment({...env,...changes}).pass,false)});
test('cutover preflight rejects new charges, experimental services, shared secrets and an expanded cohort',()=>{
 for(const changes of [{PAYMENTS_ACCEPT_NEW:'true'},{PAYMENTS_ACCEPT_NEW:undefined},
  {ENABLE_COMMUNITY:'true'},{ENABLE_WADAGENT_PROXY:'true'},{ENABLE_OPERATOR_LEADS_PROXY:'true'},
  {FF_PROVIDER_HUB:'true'},{ENABLE_OPERATOR_DOCUMENT_UPLOADS:undefined},
  {OPERATOR_BETA_MAX_OPERATORS:'25'},{INTERNAL_SERVICE_TOKEN:env.AUTH_RATE_LIMIT_SECRET}]){
  assert.equal(checkBetaEnvironment({...env,...changes}).pass,false);
 }
});
