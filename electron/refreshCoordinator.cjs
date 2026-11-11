'use strict';

// A desktop refresh is a single transaction over the currently authorized
// website sessions and API credentials. Always return a NEW snapshot, never
// write back a snapshot taken before the refresh.
function createRefreshCoordinator({ pollWeb, pollApi, readAccounts }) {
 if ([pollWeb, pollApi, readAccounts].some(fn=>typeof fn!=='function'))
  throw new TypeError('refresh coordinator dependencies must be functions');
 let active=null;
 async function refresh() {
  if (active) return active;
  active=(async()=>{
   await Promise.all([pollWeb(),pollApi()]);
   return readAccounts();
  })();
  try{return await active}
  finally{active=null}
 }
 return {refresh};
}
module.exports={createRefreshCoordinator};
