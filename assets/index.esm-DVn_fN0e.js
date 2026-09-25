import{r as _,_ as R,C,a as H,E as ue,o as j,F as Ue,g,b as Ve,v as We,i as Ge,c as Je,d as E}from"./index-BAMRknFV.js";const de="@firebase/installations",L="0.6.24";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const fe=1e4,le=`w:${L}`,pe="FIS_v2",ze="https://firebaseinstallations.googleapis.com/v1",Ye=60*60*1e3,Qe="installations",Xe="Installations";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ze={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},w=new ue(Qe,Xe,Ze);function ge(e){return e instanceof Ue&&e.code.includes("request-failed")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function he({projectId:e}){return`${ze}/projects/${e}/installations`}function we(e){return{token:e.token,requestStatus:2,expiresIn:tt(e.expiresIn),creationTime:Date.now()}}async function be(e,t){const i=(await t.json()).error;return w.create("request-failed",{requestName:e,serverCode:i.code,serverMessage:i.message,serverStatus:i.status})}function ye({apiKey:e}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e})}function et(e,{refreshToken:t}){const n=ye(e);return n.append("Authorization",nt(t)),n}async function Te(e){const t=await e();return t.status>=500&&t.status<600?e():t}function tt(e){return Number(e.replace("s","000"))}function nt(e){return`${pe} ${e}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function it({appConfig:e,heartbeatServiceProvider:t},{fid:n}){const i=he(e),r=ye(e),o=t.getImmediate({optional:!0});if(o){const s=await o.getHeartbeatsHeader();s&&r.append("x-firebase-client",s)}const a={fid:n,authVersion:pe,appId:e.appId,sdkVersion:le},u={method:"POST",headers:r,body:JSON.stringify(a)},d=await Te(()=>fetch(i,u));if(d.ok){const s=await d.json();return{fid:s.fid||n,registrationStatus:2,refreshToken:s.refreshToken,authToken:we(s.authToken)}}else throw await be("Create Installation",d)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ie(e){return new Promise(t=>{setTimeout(t,e)})}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function rt(e){return btoa(String.fromCharCode(...e)).replace(/\+/g,"-").replace(/\//g,"_")}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ot=/^[cdef][\w-]{21}$/,$="";function at(){try{const e=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(e),e[0]=112+e[0]%16;const n=st(e);return ot.test(n)?n:$}catch{return $}}function st(e){return rt(e).substr(0,22)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function I(e){return`${e.appName}!${e.appId}`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const y=new Map;function me(e,t){const n=I(e);Se(n,t),dt(n,t)}function ct(e,t){ke();const n=I(e);let i=y.get(n);i||(i=new Set,y.set(n,i)),i.add(t)}function ut(e,t){const n=I(e),i=y.get(n);i&&(i.delete(t),i.size===0&&y.delete(n),ve())}function Se(e,t){const n=y.get(e);if(n)for(const i of n)i(t)}function dt(e,t){const n=ke();n&&n.postMessage({key:e,fid:t}),ve()}let h=null;function ke(){return!h&&"BroadcastChannel"in self&&(h=new BroadcastChannel("[Firebase] FID Change"),h.onmessage=e=>{Se(e.data.key,e.data.fid)}),h}function ve(){y.size===0&&h&&(h.close(),h=null)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ft="firebase-installations-database",lt=1,b="firebase-installations-store";let F=null;function q(){return F||(F=j(ft,lt,{upgrade:(e,t)=>{switch(t){case 0:e.createObjectStore(b)}}})),F}async function D(e,t){const n=I(e),r=(await q()).transaction(b,"readwrite"),o=r.objectStore(b),a=await o.get(n);return await o.put(t,n),await r.done,(!a||a.fid!==t.fid)&&me(e,t.fid),t}async function Ae(e){const t=I(e),i=(await q()).transaction(b,"readwrite");await i.objectStore(b).delete(t),await i.done}async function N(e,t){const n=I(e),r=(await q()).transaction(b,"readwrite"),o=r.objectStore(b),a=await o.get(n),u=t(a);return u===void 0?await o.delete(n):await o.put(u,n),await r.done,u&&(!a||a.fid!==u.fid)&&me(e,u.fid),u}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function B(e){let t;const n=await N(e.appConfig,i=>{const r=pt(i),o=gt(e,r);return t=o.registrationPromise,o.installationEntry});return n.fid===$?{installationEntry:await t}:{installationEntry:n,registrationPromise:t}}function pt(e){const t=e||{fid:at(),registrationStatus:0};return Ee(t)}function gt(e,t){if(t.registrationStatus===0){if(!navigator.onLine){const r=Promise.reject(w.create("app-offline"));return{installationEntry:t,registrationPromise:r}}const n={fid:t.fid,registrationStatus:1,registrationTime:Date.now()},i=ht(e,n);return{installationEntry:n,registrationPromise:i}}else return t.registrationStatus===1?{installationEntry:t,registrationPromise:wt(e)}:{installationEntry:t}}async function ht(e,t){try{const n=await it(e,t);return D(e.appConfig,n)}catch(n){throw ge(n)&&n.customData.serverCode===409?await Ae(e.appConfig):await D(e.appConfig,{fid:t.fid,registrationStatus:0}),n}}async function wt(e){let t=await z(e.appConfig);for(;t.registrationStatus===1;)await Ie(100),t=await z(e.appConfig);if(t.registrationStatus===0){const{installationEntry:n,registrationPromise:i}=await B(e);return i||n}return t}function z(e){return N(e,t=>{if(!t)throw w.create("installation-not-found");return Ee(t)})}function Ee(e){return bt(e)?{fid:e.fid,registrationStatus:0}:e}function bt(e){return e.registrationStatus===1&&e.registrationTime+fe<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function yt({appConfig:e,heartbeatServiceProvider:t},n){const i=Tt(e,n),r=et(e,n),o=t.getImmediate({optional:!0});if(o){const s=await o.getHeartbeatsHeader();s&&r.append("x-firebase-client",s)}const a={installation:{sdkVersion:le,appId:e.appId}},u={method:"POST",headers:r,body:JSON.stringify(a)},d=await Te(()=>fetch(i,u));if(d.ok){const s=await d.json();return we(s)}else throw await be("Generate Auth Token",d)}function Tt(e,{fid:t}){return`${he(e)}/${t}/authTokens:generate`}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function U(e,t=!1){let n;const i=await N(e.appConfig,o=>{if(!_e(o))throw w.create("not-registered");const a=o.authToken;if(!t&&St(a))return o;if(a.requestStatus===1)return n=It(e,t),o;{if(!navigator.onLine)throw w.create("app-offline");const u=vt(o);return n=mt(e,u),u}});return n?await n:i.authToken}async function It(e,t){let n=await Y(e.appConfig);for(;n.authToken.requestStatus===1;)await Ie(100),n=await Y(e.appConfig);const i=n.authToken;return i.requestStatus===0?U(e,t):i}function Y(e){return N(e,t=>{if(!_e(t))throw w.create("not-registered");const n=t.authToken;return At(n)?{...t,authToken:{requestStatus:0}}:t})}async function mt(e,t){try{const n=await yt(e,t),i={...t,authToken:n};return await D(e.appConfig,i),n}catch(n){if(ge(n)&&(n.customData.serverCode===401||n.customData.serverCode===404))await Ae(e.appConfig);else{const i={...t,authToken:{requestStatus:0}};await D(e.appConfig,i)}throw n}}function _e(e){return e!==void 0&&e.registrationStatus===2}function St(e){return e.requestStatus===2&&!kt(e)}function kt(e){const t=Date.now();return t<e.creationTime||e.creationTime+e.expiresIn<t+Ye}function vt(e){const t={requestStatus:1,requestTime:Date.now()};return{...e,authToken:t}}function At(e){return e.requestStatus===1&&e.requestTime+fe<Date.now()}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Et(e){const t=e,{installationEntry:n,registrationPromise:i}=await B(t);return i?i.catch(console.error):U(t).catch(console.error),n.fid}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _t(e,t=!1){const n=e;return await Rt(n),(await U(n,t)).token}async function Rt(e){const{registrationPromise:t}=await B(e);t&&await t}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Ct(e,t){const{appConfig:n}=e;return ct(n,t),()=>{ut(n,t)}}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Dt(e){if(!e||!e.options)throw M("App Configuration");if(!e.name)throw M("App Name");const t=["projectId","apiKey","appId"];for(const n of t)if(!e.options[n])throw M(n);return{appName:e.name,projectId:e.options.projectId,apiKey:e.options.apiKey,appId:e.options.appId}}function M(e){return w.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Re="installations",Nt="installations-internal",Ot=e=>{const t=e.getProvider("app").getImmediate(),n=Dt(t),i=H(t,"heartbeat");return{app:t,appConfig:n,heartbeatServiceProvider:i,_delete:()=>Promise.resolve()}},Ft=e=>{const t=e.getProvider("app").getImmediate(),n=H(t,Re).getImmediate();return{getId:()=>Et(n),getToken:r=>_t(n,r)}};function Mt(){R(new C(Re,Ot,"PUBLIC")),R(new C(Nt,Ft,"PRIVATE"))}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Mt();_(de,L);_(de,L,"esm2020");/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Pt="/firebase-messaging-sw.js",Kt="/firebase-cloud-messaging-push-scope",Ce="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",$t="https://fcmregistrations.googleapis.com/v1",De="google.c.a.c_id",xt="google.c.a.c_l",Ht="google.c.a.ts",jt="google.c.a.e",Q=1e4;var X;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(X||(X={}));/**
 * @license
 * Copyright 2018 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License. You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software distributed under the License
 * is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express
 * or implied. See the License for the specific language governing permissions and limitations under
 * the License.
 */var T;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked",e.FID_REGISTERED="fid-registered"})(T||(T={}));/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function f(e){const t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function Ne(e){const t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),i=atob(n),r=new Uint8Array(i.length);for(let o=0;o<i.length;++o)r[o]=i.charCodeAt(o);return r}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const P="fcm_token_details_db",Lt=5,Z="fcm_token_object_Store";async function qt(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(P))return null;let t=null;return(await j(P,Lt,{upgrade:async(i,r,o,a)=>{if(r<2||!i.objectStoreNames.contains(Z))return;const u=a.objectStore(Z),d=await u.index("fcmSenderId").get(e);if(await u.clear(),!!d){if(r===2){const s=d;if(!s.auth||!s.p256dh||!s.endpoint)return;t={token:s.fcmToken,createTime:s.createTime??Date.now(),subscriptionOptions:{auth:s.auth,p256dh:s.p256dh,endpoint:s.endpoint,swScope:s.swScope,vapidKey:typeof s.vapidKey=="string"?s.vapidKey:f(s.vapidKey)}}}else if(r===3){const s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:f(s.auth),p256dh:f(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:f(s.vapidKey)}}}else if(r===4){const s=d;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:f(s.auth),p256dh:f(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:f(s.vapidKey)}}}}}})).close(),await E(P),await E("fcm_vapid_details_db"),await E("undefined"),Bt(t)?t:null}function Bt(e){if(!e||!e.subscriptionOptions)return!1;const{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Ut={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","fid-registration-failed":"A problem occurred while creating an FCM registration via FID: {$errorInfo}","fid-unregister-failed":"A problem occurred while unregistering the FCM registration via FID: {$errorInfo}","fid-registration-idb-schema-unavailable":"Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.","invalid-on-registered-handler":"No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."},c=new ue("messaging","Messaging",Ut);/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const ee="firebase-messaging-database",te=2,p="firebase-messaging-store",l="firebase-messaging-fid-registration-store",Vt={openDB:j,deleteDB:E};let ne=Vt,k=null;function Wt(e,t,n){switch(t){case 0:if(e.createObjectStore(p),n===1)break;case 1:n===2&&e.createObjectStore(l)}}function ie(e){return{upgrade:(t,n)=>{Wt(t,n,e)},blocked:()=>{},blocking:(t,n,i)=>{var r;k=null,(r=i.target)==null||r.close()},terminated:()=>{k=null}}}function m(){return k||(k=ne.openDB(ee,te,ie(2)).catch(()=>ne.openDB(ee,te-1,ie(1)))),k}function Oe(e,t){return e.objectStoreNames.contains(t)}function V(e){if(!Oe(e,l))throw c.create("fid-registration-idb-schema-unavailable")}async function Fe(e){const t=S(e),i=await(await m()).transaction(p).objectStore(p).get(t);if(i)return i;{const r=await qt(e.appConfig.senderId);if(r)return await W(e,r),r}}async function W(e,t){const n=S(e),i=await m(),r=[p],o=Oe(i,l);o&&r.push(l);const a=i.transaction(r,"readwrite");return await a.objectStore(p).put(t,n),o&&await a.objectStore(l).delete(n),await a.done,t}async function Me(e){const t=S(e),i=(await m()).transaction(p,"readwrite");await i.objectStore(p).delete(t),await i.done}async function O(e){const t=S(e),n=await m();return V(n),await n.transaction(l).objectStore(l).get(t)}async function Gt(e,t){const n=S(e),i=await m();V(i);const r=i.transaction([p,l],"readwrite");return await r.objectStore(l).put(t,n),await r.objectStore(p).delete(n),await r.done,t}async function Pe(e){const t=S(e),n=await m();V(n);const i=n.transaction(l,"readwrite");await i.objectStore(l).delete(t),await i.done}function S({appConfig:e}){return e.appId}const re="@firebase/messaging",x="0.13.3";/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Jt=3,zt=1e3;async function Yt(e,t){const n=await A(e),i=G(t,e.appConfig.appName,!1),r={method:"POST",headers:n,body:JSON.stringify(i)};let o;try{o=await(await fetch(v(e.appConfig),r)).json()}catch(a){throw c.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw c.create("token-subscribe-failed",{errorInfo:a})}if(!o.token)throw c.create("token-subscribe-no-token");return o.token}async function Qt(e,t){var d;const n=await A(e),i=G(t,e.appConfig.appName,!0),r={method:"POST",headers:n,body:JSON.stringify(i)};let o;try{o=await tn(()=>fetch(v(e.appConfig),r),Jt,zt)}catch(s){throw c.create("fid-registration-failed",{errorInfo:s==null?void 0:s.toString()})}if(o.ok)return{responseFid:await Xt(o)};let a;try{a=await o.json()}catch{throw c.create("fid-registration-failed",{errorInfo:o.statusText})}const u=((d=a.error)==null?void 0:d.message)??o.statusText;throw c.create("fid-registration-failed",{errorInfo:u})}async function Ke(e,t){var o;const i={method:"DELETE",headers:await A(e)};let r;try{r=await fetch(`${v(e.appConfig)}/${t}`,i)}catch(a){throw c.create("fid-unregister-failed",{errorInfo:a==null?void 0:a.toString()})}if(!r.ok)try{throw((o=(await r.json()).error)==null?void 0:o.message)??r.statusText}catch(a){throw c.create("fid-unregister-failed",{errorInfo:typeof a=="string"&&a||r.statusText||(a==null?void 0:a.toString())})}}async function Xt(e){const t=await e.text();if(!t.trim())throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is empty"});let n;try{n=JSON.parse(t)}catch{throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is not valid JSON"})}const i=n.name;if(typeof i!="string"||i.length===0)throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response did not include a non-empty name"});return Zt(i)}const oe="/registrations/";function Zt(e){const t=e.indexOf(oe);if(t!==-1){const n=e.slice(t+oe.length);if(n.length>0)return n}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response name is not a valid registration resource name"})}async function en(e,t){const n=await A(e),i=G(t.subscriptionOptions,e.appConfig.appName,!1),r={method:"PATCH",headers:n,body:JSON.stringify(i)};let o;try{o=await(await fetch(`${v(e.appConfig)}/${t.token}`,r)).json()}catch(a){throw c.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw c.create("token-update-failed",{errorInfo:a})}if(!o.token)throw c.create("token-update-no-token");return o.token}async function $e(e,t){const i={method:"DELETE",headers:await A(e)};try{const o=await(await fetch(`${v(e.appConfig)}/${t}`,i)).json();if(o.error){const a=o.error.message;throw c.create("token-unsubscribe-failed",{errorInfo:a})}}catch(r){throw c.create("token-unsubscribe-failed",{errorInfo:r==null?void 0:r.toString()})}}async function tn(e,t,n){let i;for(let r=0;r<t;r++)try{return await e()}catch(o){if(i=o,r<t-1){const a=n*Math.pow(2,r);await new Promise(u=>setTimeout(u,a))}}throw i}function v({projectId:e}){return`${$t}/projects/${e}/registrations`}async function A({appConfig:e,installations:t}){const n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function nn(e,t){var n,i;try{if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))return new URL(e).host}catch{}try{if(typeof self<"u"&&((n=self.location)!=null&&n.href))return new URL(e,self.location.origin).host}catch{}return typeof self<"u"&&((i=self.location)!=null&&i.host)?self.location.host:t}function G({p256dh:e,auth:t,endpoint:n,vapidKey:i,swScope:r},o,a){const u={web:{origin:nn(r,o),endpoint:n,auth:t,p256dh:e}};return a&&(u.fcm_sdk_version=x),i!==Ce&&(u.web.applicationPubKey=i),u}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const rn=7*24*60*60*1e3;async function on(e){const t=await dn(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:f(t.getKey("auth")),p256dh:f(t.getKey("p256dh"))},i=await Fe(e.firebaseDependencies);if(i){if(fn(i.subscriptionOptions,n))return Date.now()>=i.createTime+rn?un(e,{token:i.token,createTime:Date.now(),subscriptionOptions:n}):i.token;try{await $e(e.firebaseDependencies,i.token)}catch(r){console.warn(r)}return ae(e.firebaseDependencies,n)}else return ae(e.firebaseDependencies,n)}async function an(e,t){await $e(e.firebaseDependencies,t.token),await Me(e.firebaseDependencies),await xe(e.firebaseDependencies)}async function sn(e){const t=await O(e.firebaseDependencies).catch(()=>{}),n=t==null?void 0:t.fid;n&&await Ke(e.firebaseDependencies,n),await xe(e.firebaseDependencies),n&&pn(e,n)}async function cn(e){const t=await Fe(e.firebaseDependencies);t?await an(e,t):await sn(e);const n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function un(e,t){try{const n=await en(e.firebaseDependencies,t),i={...t,token:n,createTime:Date.now()};return await W(e.firebaseDependencies,i),n}catch(n){throw n}}async function ae(e,t){const i={token:await Yt(e,t),createTime:Date.now(),subscriptionOptions:t};return await W(e,i),i.token}async function dn(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Ne(t)})}function fn(e,t){const n=t.vapidKey===e.vapidKey,i=t.endpoint===e.endpoint,r=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&i&&r&&o}async function xe(e){try{await Pe(e)}catch{}}function ln(e,t){const n=e.onRegisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}function pn(e,t){const n=e.onUnregisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function He(e){try{e.swRegistration=await navigator.serviceWorker.register(Pt,{scope:Kt}),e.swRegistration.update().catch(()=>{}),await gn(e.swRegistration)}catch(t){throw c.create("failed-service-worker-registration",{browserErrorMessage:t==null?void 0:t.message})}}async function gn(e){return new Promise((t,n)=>{const i=setTimeout(()=>n(new Error(`Service worker not registered after ${Q} ms`)),Q),r=e.installing||e.waiting;e.active?(clearTimeout(i),t()):r?r.onstatechange=o=>{var a;((a=o.target)==null?void 0:a.state)==="activated"&&(r.onstatechange=null,clearTimeout(i),t())}:(clearTimeout(i),n(new Error("No incoming service worker found.")))})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function je(e,t){if(!t&&!e.swRegistration&&await He(e),!(!t&&e.swRegistration)){if(!(t instanceof ServiceWorkerRegistration))throw c.create("invalid-sw-registration");e.swRegistration=t}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Le(e,t){t?e.vapidKey=t:e.vapidKey||(e.vapidKey=Ce)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const se=3;async function hn(e,t){const n=await wn(e.swRegistration,e.vapidKey),i={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:n.endpoint,auth:f(n.getKey("auth")),p256dh:f(n.getKey("p256dh"))},r=e.firebaseDependencies.installations;for(let o=0;o<se;o++){const{responseFid:a}=await Qt(e.firebaseDependencies,i);if(a===t)return;o<se-1&&await r.getToken(!0)}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration response FID does not match Firebase Installation ID"})}async function wn(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:Ne(t)})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const bn=7*24*60*60*1e3;async function J(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");if(!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");await Le(e,t==null?void 0:t.vapidKey),await je(e,t==null?void 0:t.serviceWorkerRegistration);const n=e._registerNotifyChain.catch(()=>{});return e._registerNotifyChain=n.then(async()=>{const i=await e.firebaseDependencies.installations.getId(),r=await O(e.firebaseDependencies),o=Date.now();if((!r||r.fid!==i||o>=r.lastRegisterTime+bn)&&(await hn(e,i),await Gt(e.firebaseDependencies,{fid:i,lastRegisterTime:o,vapidKey:e.vapidKey})),!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");ln(e,i)}),e._registerNotifyChain}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function yn(e,t){return Ct(t,()=>{(async()=>!e.onRegisteredHandler||!await O(e.firebaseDependencies)||await J(e).catch(()=>{}))()})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function ce(e){const t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Tn(t,e),In(t,e),mn(t,e),t}function Tn(e,t){if(!t.notification)return;e.notification={};const n=t.notification.title;n&&(e.notification.title=n);const i=t.notification.body;i&&(e.notification.body=i);const r=t.notification.image;r&&(e.notification.image=r);const o=t.notification.icon;o&&(e.notification.icon=o)}function In(e,t){t.data&&(e.data=t.data)}function mn(e,t){var r,o,a,u;if(!t.fcmOptions&&!((r=t.notification)!=null&&r.click_action))return;e.fcmOptions={};const n=((o=t.fcmOptions)==null?void 0:o.link)??((a=t.notification)==null?void 0:a.click_action);n&&(e.fcmOptions.link=n);const i=(u=t.fcmOptions)==null?void 0:u.analytics_label;i&&(e.fcmOptions.analyticsLabel=i)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Sn(e){return typeof e=="object"&&!!e&&De in e}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function kn(e){if(!e||!e.options)throw K("App Configuration Object");if(!e.name)throw K("App Name");const t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(const i of t)if(!n[i])throw K(i);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function K(e){return c.create("missing-app-config-values",{valueName:e})}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */class vn{constructor(t,n,i){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.onRegisteredHandler=null,this.onUnregisteredHandler=null,this._registerNotifyChain=Promise.resolve(),this._fidChangeUnsubscribe=null,this.logEvents=[],this.logQueue={state:"stopped"};const r=kn(t);this.firebaseDependencies={app:t,appConfig:r,installations:n,analyticsProvider:i}}_delete(){return this._fidChangeUnsubscribe&&(this._fidChangeUnsubscribe(),this._fidChangeUnsubscribe=null),this.logQueue.state==="scheduled"&&clearTimeout(this.logQueue.timerId),this.logQueue={state:"stopped"},Promise.resolve()}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function qe(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");return await Le(e,t==null?void 0:t.vapidKey),await je(e,t==null?void 0:t.serviceWorkerRegistration),on(e)}/**
 * @license
 * Copyright 2019 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function An(e,t,n){const i=En(t);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(i,{message_id:n[De],message_name:n[xt],message_time:n[Ht],message_device_time:Math.floor(Date.now()/1e3)})}function En(e){switch(e){case T.NOTIFICATION_CLICKED:return"notification_open";case T.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function _n(e,t){const n=t.data;if(!n.isFirebaseMessaging)return;if(e.onMessageHandler&&n.messageType===T.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(ce(n)):e.onMessageHandler.next(ce(n))),e.onRegisteredHandler&&n.messageType===T.FID_REGISTERED){const r=n.fid;typeof e.onRegisteredHandler=="function"?e.onRegisteredHandler(r):e.onRegisteredHandler.next(r)}const i=n.data;Sn(i)&&i[jt]==="1"&&await An(e,n.messageType,i)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */const Rn=e=>{const t=new vn(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",n=>_n(t,n)),t._fidChangeUnsubscribe=yn(t,e.getProvider("installations").getImmediate()),t},Cn=e=>{const t=e.getProvider("messaging").getImmediate();return{getToken:i=>qe(t,i),register:i=>J(t,i)}};function Dn(){R(new C("messaging",Rn,"PUBLIC")),R(new C("messaging-internal",Cn,"PRIVATE")),_(re,x),_(re,x,"esm2020")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Nn(){try{await We()}catch{return!1}return typeof window<"u"&&Ge()&&Je()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function On(e){if(!navigator)throw c.create("only-available-in-window");return e.swRegistration||await He(e),cn(e)}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Fn(e,t){if(!navigator)throw c.create("only-available-in-window");return e.onMessageHandler=t,()=>{e.onMessageHandler=null}}/**
 * @license
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Mn(e,t){return e.onRegisteredHandler=t,()=>{e.onRegisteredHandler===t&&(e.onRegisteredHandler=null)}}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function Pn(e,t){return e.onUnregisteredHandler=t,()=>{e.onUnregisteredHandler===t&&(e.onUnregisteredHandler=null)}}/**
 * @license
 * Copyright 2026 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */async function Kn(e){if(!navigator)throw c.create("only-available-in-window");const t=await O(e.firebaseDependencies).catch(()=>{}),n=(t==null?void 0:t.fid)??await e.firebaseDependencies.installations.getId();await Ke(e.firebaseDependencies,n);try{await Pe(e.firebaseDependencies)}catch{}try{await Me(e.firebaseDependencies)}catch{}const i=e.onUnregisteredHandler;i&&(typeof i=="function"?i(n):i.next(n))}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */function xn(e=Ve()){return Nn().then(t=>{if(!t)throw c.create("unsupported-browser")},t=>{throw c.create("indexed-db-unsupported")}),H(g(e),"messaging").getImmediate()}async function Hn(e,t){return e=g(e),qe(e,t)}function jn(e){return e=g(e),On(e)}function Ln(e,t){return e=g(e),Fn(e,t)}async function qn(e,t){return e=g(e),J(e,t)}async function Bn(e){return e=g(e),Kn(e)}function Un(e,t){return e=g(e),Mn(e,t)}function Vn(e,t){return e=g(e),Pn(e,t)}/**
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */Dn();export{jn as deleteToken,xn as getMessaging,Hn as getToken,Nn as isSupported,Ln as onMessage,Un as onRegistered,Vn as onUnregistered,qn as register,Bn as unregister};
