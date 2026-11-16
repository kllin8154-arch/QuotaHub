import { useEffect, useState } from 'react'
import { ShieldCheck } from 'lucide-react'
import type { GoogleIdentityState } from './types'

export default function GoogleAvatar({profile}:{profile:GoogleIdentityState['profile']}) {
 const [failed,setFailed]=useState(false)
 useEffect(()=>setFailed(false),[profile?.picture])
 const initial=(profile?.name||profile?.email||'').trim().slice(0,1).toLocaleUpperCase()||'G'
 return <span className={'google-avatar'+(profile?' is-linked':' is-local')} aria-hidden="true">
  {profile?.picture&&!failed?
   <img src={profile.picture} alt="" referrerPolicy="no-referrer" onError={()=>setFailed(true)}/>:
   profile?<span className="google-avatar-initial">{initial}</span>:<ShieldCheck size={18}/>}
 </span>
}
