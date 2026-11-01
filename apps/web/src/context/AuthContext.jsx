import {createContext,useContext,useEffect,useMemo,useState} from 'react';
import {AppConfig} from '../config/appConfig';
import {webSession,sessionState,subscribeSession,sessionFetch,signalSessionChange} from '../lib/web-request';
const AuthContext=createContext({user:null,sessionKey:null,loading:true});
export function AuthProvider({children}){
  const [state,setState]=useState(sessionState),[loading,setLoading]=useState(true),[error,setError]=useState(null);
  useEffect(()=>{
    let active=true;const unsubscribe=subscribeSession(next=>{if(active)setState(next);});
    for(const key of ['wadatrip_token','wadatrip_admin_token']){try{localStorage.removeItem(key);sessionStorage.removeItem(key);}catch{}}
    if(window.location.hash.startsWith('#auth_token='))history.replaceState(history.state,'',location.pathname+location.search);
    const restore=()=>{if(!sessionState().user)setLoading(true);webSession.bootstrap().catch(err=>{if(active)setError(err);}).finally(()=>{if(active)setLoading(false);});};
    const changed=event=>{if(event.key==='wadatrip_auth_revision'){webSession.invalidate();restore();}};
    const pageshow=event=>{if(event.persisted){webSession.invalidate();restore();}};
    window.addEventListener('storage',changed);window.addEventListener('pageshow',pageshow);restore();
    window.addEventListener('focus',restore);
    return()=>{active=false;unsubscribe();window.removeEventListener('storage',changed);window.removeEventListener('pageshow',pageshow);window.removeEventListener('focus',restore);};
  },[]);
  const value=useMemo(()=>{
    const authenticate=async(path,body)=>{setError(null);const result=await webSession.authenticate(path,body);signalSessionChange();return result;};
    return{...state,loading,error,request:sessionFetch,
      login:body=>authenticate('/auth/login',body),register:body=>authenticate('/auth/register',body),verifyCode:body=>authenticate('/auth/verify-code',body),requestCode:body=>webSession.requestCode(body),
      logout:()=>{const result=webSession.logout();signalSessionChange();result.catch(setError);return result;},refreshProfile:()=>webSession.bootstrap(),
      updateProfile:async body=>{const response=await sessionFetch(`${AppConfig.api.baseUrl}/auth/update`,{method:'PATCH',body:JSON.stringify(body)});if(!response.ok)throw new Error('Could not update your profile.');const user=await response.json();await webSession.bootstrap();return user;},
    };
  },[state,loading,error]);
  return <AuthContext.Provider value={value}>{children}{state.logoutPending&&<div role="alert">Server sign-out is pending. <button type="button" onClick={()=>value.logout().catch(()=>{})}>Retry sign-out</button></div>}</AuthContext.Provider>;
}
export const useAuth=()=>useContext(AuthContext);
