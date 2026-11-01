import {getPrisma} from '@wadatrip/db';
import {Prisma} from '@prisma/client';
import {operatorBetaCapabilities} from '@wadatrip/common/security';

export function betaConfigurationErrors(env:NodeJS.ProcessEnv) {
  const errors:string[]=[];
  if(env.OPERATOR_BETA_PREPARATION_ONLY!=='true')errors.push('preparation_only');
  if(env.PAYMENTS_ACCEPT_NEW!=='false'||env.PAYMENTS_LIVE_ENABLED!=='false')errors.push('new_payments_closed');
  for(const key of ['ENABLE_OPERATOR_DOCUMENT_UPLOADS','ENABLE_OPERATOR_LEADS','ENABLE_OPERATOR_LEAD_SEARCH','ENABLE_OPERATOR_LEADS_PROXY','ENABLE_WADAGENT_PROXY','ENABLE_COMMUNITY','FF_PROVIDER_HUB'])if(env[key]!=='false')errors.push(key);
  if(String(env.OPERATOR_BETA_MAX_OPERATORS||5)!=='5')errors.push('cohort_cap');
  const hops=Number(env.AUTH_TRUSTED_PROXY_HOPS||0);
  if(!Number.isInteger(hops)||hops<0||hops>4||(hops>0&&(env.RENDER!=='true'||!env.RENDER_SERVICE_ID)))errors.push('trusted_proxy_configuration');
  if(String(env.OPERATOR_BETA_PUBLICATION_USER_IDS||'').trim())errors.push('publication_closed');
  if((env.AUTH_RATE_LIMIT_SECRET||'').length<32||(env.INTERNAL_SERVICE_TOKEN||'').length<32||env.AUTH_RATE_LIMIT_SECRET===env.INTERNAL_SERVICE_TOKEN)errors.push('independent_security_secrets');
  for(const [key,max] of [['JWT_TTL_SECONDS',604800],['AUTH_SESSION_WEB_TTL_SECONDS',28800],['AUTH_SESSION_WEB_IDLE_SECONDS',3600]] as const){
    if(env[key]!==undefined&&(!Number.isSafeInteger(Number(env[key]))||Number(env[key])<60||Number(env[key])>max))errors.push(key);
  }
  try{operatorBetaCapabilities({id:'runtime-no-actor',verified:true,admin:false},env);}catch{errors.push('cohort_configuration');}
  return errors;
}

export async function verifyBetaRuntime(env=process.env,db:any=getPrisma()) {
  const errors=betaConfigurationErrors(env);
  if(errors.length)throw Error('Operator beta configuration rejected: '+errors.join(','));
  const rows=await db.$transaction(async(tx:any)=>{
    await tx.$executeRaw`SET TRANSACTION READ ONLY`;
    return tx.$queryRaw`SELECT current_setting('server_version_num')::int AS version,
      to_regclass('public.auth_request_limits') IS NOT NULL AS auth_ready,
      to_regclass('public.operator_booking_reviews') IS NOT NULL AS inbox_ready,
      (to_regclass('public.auth_sessions') IS NOT NULL
       AND (SELECT count(*) FROM information_schema.columns WHERE table_schema='public' AND table_name='users' AND column_name IN ('auth_epoch','reauth_after'))=2
       AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.auth_sessions') AND tgname='auth_session_monotonic' AND tgenabled<>'D')
       AND EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid=to_regclass('public.users') AND tgname='auth_user_epoch_monotonic' AND tgenabled<>'D')
       AND EXISTS(SELECT 1 FROM _prisma_migrations WHERE migration_name='20261030000000_auth_sessions' AND finished_at IS NOT NULL AND rolled_back_at IS NULL)) AS sessions_ready,
      (SELECT count(*)::int FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL) AS unfinished`;
  },{maxWait:3000,timeout:10000});
  const row=rows[0];
  if(!row?.auth_ready||!row?.inbox_ready||!row?.sessions_ready||row.unfinished!==0)throw Error('Operator beta schema readiness failed');
  console.log(JSON.stringify({operation:'operator_beta_runtime',result:'ready',node:process.versions.node,prisma:Prisma.prismaVersion.client,database_major:Math.floor(row.version/10000),release:env.RENDER_GIT_COMMIT||'local',proxy_hops:Number(env.AUTH_TRUSTED_PROXY_HOPS||0)}));
}
