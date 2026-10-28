// Read-only local environment validation. Never loads dotenv or contacts any service.
const {operatorBetaCapabilities}=require('@wadatrip/common/security');
function checkBetaEnvironment(env){
 const errors=[];
 let caps;
 try{caps=operatorBetaCapabilities({id:'preflight-no-user',verified:true,admin:false},env)}catch{errors.push('invalid_cohort_configuration')}
 if(env.OPERATOR_BETA_PREPARATION_ONLY!=='true')errors.push('preparation_only_must_be_explicit');
 if(env.PAYMENTS_LIVE_ENABLED!=='false')errors.push('live_payments_must_be_explicitly_disabled');
 if(env.ENABLE_OPERATOR_DOCUMENT_UPLOADS==='true')errors.push('identity_document_uploads_must_remain_closed');
 if(env.ENABLE_OPERATOR_LEADS==='true'||env.ENABLE_OPERATOR_LEAD_SEARCH==='true')errors.push('lead_acquisition_not_part_of_onboarding_beta');
 const members=[...new Set(String(env.OPERATOR_BETA_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean))];
 const publishers=[...new Set(String(env.OPERATOR_BETA_PUBLICATION_USER_IDS||'').split(',').map(v=>v.trim()).filter(Boolean))];
 if(publishers.length)errors.push('preparation_beta_must_not_grant_publication');
 if(String(env.AUTH_RATE_LIMIT_SECRET||'').trim().length<32)errors.push('stable_auth_rate_limit_secret_minimum_32_characters');
 if(String(env.INTERNAL_SERVICE_TOKEN||'').trim().length<32)errors.push('internal_service_token_minimum_32_characters');
 return {pass:errors.length===0,member_count:members.length,publication_count:publishers.length,preparation_only:caps?.preparation_only===true,errors};
}
module.exports={checkBetaEnvironment};
if(require.main===module){const result=checkBetaEnvironment(process.env);console.log(JSON.stringify(result));if(!result.pass)process.exitCode=1;}
