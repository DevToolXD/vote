import{n as p,w as ae,b as se,a6 as ce,a9 as de,l as ue,aa as fe,ab as G,ac as v,o as C,C as O,r as N,ad as le}from"./fb-core-C18BJ22g.js";/**
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
 */const pe="/firebase-messaging-sw.js",he="/firebase-cloud-messaging-push-scope",V="BDOU99-h67HcA6JeFXHbSNMu7e2yNNu3RzoMj8TM4W88jITfq7ZmPvIM1Iv-4_l2LxQcYwhqby2xGpWwzjfAnG4",we="https://fcmregistrations.googleapis.com/v1",q="google.c.a.c_id",be="google.c.a.c_l",ge="google.c.a.ts",ye="google.c.a.e",M=1e4;var F;(function(e){e[e.DATA_MESSAGE=1]="DATA_MESSAGE",e[e.DISPLAY_NOTIFICATION=3]="DISPLAY_NOTIFICATION"})(F||(F={}));/**
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
 */var w;(function(e){e.PUSH_RECEIVED="push-received",e.NOTIFICATION_CLICKED="notification-clicked",e.FID_REGISTERED="fid-registered"})(w||(w={}));/**
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
 */function u(e){const t=new Uint8Array(e);return btoa(String.fromCharCode(...t)).replace(/=/g,"").replace(/\+/g,"-").replace(/\//g,"_")}function J(e){const t="=".repeat((4-e.length%4)%4),n=(e+t).replace(/\-/g,"+").replace(/_/g,"/"),i=atob(n),r=new Uint8Array(i.length);for(let o=0;o<i.length;++o)r[o]=i.charCodeAt(o);return r}/**
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
 */const S="fcm_token_details_db",Te=5,K="fcm_token_object_Store";async function Ie(e){if("databases"in indexedDB&&!(await indexedDB.databases()).map(o=>o.name).includes(S))return null;let t=null;return(await G(S,Te,{upgrade:async(i,r,o,a)=>{if(r<2||!i.objectStoreNames.contains(K))return;const d=a.objectStore(K),h=await d.index("fcmSenderId").get(e);if(await d.clear(),!!h){if(r===2){const s=h;if(!s.auth||!s.p256dh||!s.endpoint)return;t={token:s.fcmToken,createTime:s.createTime??Date.now(),subscriptionOptions:{auth:s.auth,p256dh:s.p256dh,endpoint:s.endpoint,swScope:s.swScope,vapidKey:typeof s.vapidKey=="string"?s.vapidKey:u(s.vapidKey)}}}else if(r===3){const s=h;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:u(s.auth),p256dh:u(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:u(s.vapidKey)}}}else if(r===4){const s=h;t={token:s.fcmToken,createTime:s.createTime,subscriptionOptions:{auth:u(s.auth),p256dh:u(s.p256dh),endpoint:s.endpoint,swScope:s.swScope,vapidKey:u(s.vapidKey)}}}}}})).close(),await v(S),await v("fcm_vapid_details_db"),await v("undefined"),ve(t)?t:null}function ve(e){if(!e||!e.subscriptionOptions)return!1;const{subscriptionOptions:t}=e;return typeof e.createTime=="number"&&e.createTime>0&&typeof e.token=="string"&&e.token.length>0&&typeof t.auth=="string"&&t.auth.length>0&&typeof t.p256dh=="string"&&t.p256dh.length>0&&typeof t.endpoint=="string"&&t.endpoint.length>0&&typeof t.swScope=="string"&&t.swScope.length>0&&typeof t.vapidKey=="string"&&t.vapidKey.length>0}/**
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
 */const ke={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"only-available-in-window":"This method is available in a Window context.","only-available-in-sw":"This method is available in a service worker context.","permission-default":"The notification permission was not granted and dismissed instead.","permission-blocked":"The notification permission was not granted and blocked instead.","unsupported-browser":"This browser doesn't support the API's required to use the Firebase SDK.","indexed-db-unsupported":"This browser doesn't support indexedDb.open() (ex. Safari iFrame, Firefox Private Browsing, etc)","failed-service-worker-registration":"We are unable to register the default service worker. {$browserErrorMessage}","token-subscribe-failed":"A problem occurred while subscribing the user to FCM: {$errorInfo}","token-subscribe-no-token":"FCM returned no token when subscribing the user to push.","fid-registration-failed":"A problem occurred while creating an FCM registration via FID: {$errorInfo}","fid-unregister-failed":"A problem occurred while unregistering the FCM registration via FID: {$errorInfo}","fid-registration-idb-schema-unavailable":"Unable to read or persist FID registration metadata because the messaging IndexedDB schema is unavailable (for example, the database could not be upgraded to the latest version).","token-unsubscribe-failed":"A problem occurred while unsubscribing the user from FCM: {$errorInfo}","token-update-failed":"A problem occurred while updating the user from FCM: {$errorInfo}","token-update-no-token":"FCM returned no token when updating the user to push.","use-sw-after-get-token":"The useServiceWorker() method may only be called once and must be called before calling getToken() to ensure your service worker is used.","invalid-sw-registration":"The input to useServiceWorker() must be a ServiceWorkerRegistration.","invalid-bg-handler":"The input to setBackgroundMessageHandler() must be a function.","invalid-vapid-key":"The public VAPID key must be a string.","use-vapid-key-after-get-token":"The usePublicVapidKey() method may only be called once and must be called before calling getToken() to ensure your VAPID key is used.","invalid-on-registered-handler":"No onRegistered callback handler was provided or registered. Implement onRegistered() before register()."},c=new ae("messaging","Messaging",ke);/**
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
 */const P="firebase-messaging-database",H=2,l="firebase-messaging-store",f="firebase-messaging-fid-registration-store",Se={openDB:G,deleteDB:v};let x=Se,y=null;function _e(e,t,n){switch(t){case 0:if(e.createObjectStore(l),n===1)break;case 1:n===2&&e.createObjectStore(f)}}function j(e){return{upgrade:(t,n)=>{_e(t,n,e)},blocked:()=>{},blocking:(t,n,i)=>{var r;y=null,(r=i.target)==null||r.close()},terminated:()=>{y=null}}}function b(){return y||(y=x.openDB(P,H,j(2)).catch(()=>x.openDB(P,H-1,j(1)))),y}function Q(e,t){return e.objectStoreNames.contains(t)}function E(e){if(!Q(e,f))throw c.create("fid-registration-idb-schema-unavailable")}async function Y(e){const t=g(e),i=await(await b()).transaction(l).objectStore(l).get(t);if(i)return i;{const r=await Ie(e.appConfig.senderId);if(r)return await R(e,r),r}}async function R(e,t){const n=g(e),i=await b(),r=[l],o=Q(i,f);o&&r.push(f);const a=i.transaction(r,"readwrite");return await a.objectStore(l).put(t,n),o&&await a.objectStore(f).delete(n),await a.done,t}async function z(e){const t=g(e),i=(await b()).transaction(l,"readwrite");await i.objectStore(l).delete(t),await i.done}async function k(e){const t=g(e),n=await b();return E(n),await n.transaction(f).objectStore(f).get(t)}async function me(e,t){const n=g(e),i=await b();E(i);const r=i.transaction([l,f],"readwrite");return await r.objectStore(f).put(t,n),await r.objectStore(l).delete(n),await r.done,t}async function X(e){const t=g(e),n=await b();E(n);const i=n.transaction(f,"readwrite");await i.objectStore(f).delete(t),await i.done}function g({appConfig:e}){return e.appId}const L="@firebase/messaging",m="0.13.3";/**
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
 */const Ee=3,Re=1e3;async function De(e,t){const n=await I(e),i=D(t,e.appConfig.appName,!1),r={method:"POST",headers:n,body:JSON.stringify(i)};let o;try{o=await(await fetch(T(e.appConfig),r)).json()}catch(a){throw c.create("token-subscribe-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw c.create("token-subscribe-failed",{errorInfo:a})}if(!o.token)throw c.create("token-subscribe-no-token");return o.token}async function Ae(e,t){var h;const n=await I(e),i=D(t,e.appConfig.appName,!0),r={method:"POST",headers:n,body:JSON.stringify(i)};let o;try{o=await Me(()=>fetch(T(e.appConfig),r),Ee,Re)}catch(s){throw c.create("fid-registration-failed",{errorInfo:s==null?void 0:s.toString()})}if(o.ok)return{responseFid:await Ce(o)};let a;try{a=await o.json()}catch{throw c.create("fid-registration-failed",{errorInfo:o.statusText})}const d=((h=a.error)==null?void 0:h.message)??o.statusText;throw c.create("fid-registration-failed",{errorInfo:d})}async function Z(e,t){var o;const i={method:"DELETE",headers:await I(e)};let r;try{r=await fetch(`${T(e.appConfig)}/${t}`,i)}catch(a){throw c.create("fid-unregister-failed",{errorInfo:a==null?void 0:a.toString()})}if(!r.ok)try{throw((o=(await r.json()).error)==null?void 0:o.message)??r.statusText}catch(a){throw c.create("fid-unregister-failed",{errorInfo:typeof a=="string"&&a||r.statusText||(a==null?void 0:a.toString())})}}async function Ce(e){const t=await e.text();if(!t.trim())throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is empty"});let n;try{n=JSON.parse(t)}catch{throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response body is not valid JSON"})}const i=n.name;if(typeof i!="string"||i.length===0)throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response did not include a non-empty name"});return Oe(i)}const U="/registrations/";function Oe(e){const t=e.indexOf(U);if(t!==-1){const n=e.slice(t+U.length);if(n.length>0)return n}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration succeeded but response name is not a valid registration resource name"})}async function Ne(e,t){const n=await I(e),i=D(t.subscriptionOptions,e.appConfig.appName,!1),r={method:"PATCH",headers:n,body:JSON.stringify(i)};let o;try{o=await(await fetch(`${T(e.appConfig)}/${t.token}`,r)).json()}catch(a){throw c.create("token-update-failed",{errorInfo:a==null?void 0:a.toString()})}if(o.error){const a=o.error.message;throw c.create("token-update-failed",{errorInfo:a})}if(!o.token)throw c.create("token-update-no-token");return o.token}async function ee(e,t){const i={method:"DELETE",headers:await I(e)};try{const o=await(await fetch(`${T(e.appConfig)}/${t}`,i)).json();if(o.error){const a=o.error.message;throw c.create("token-unsubscribe-failed",{errorInfo:a})}}catch(r){throw c.create("token-unsubscribe-failed",{errorInfo:r==null?void 0:r.toString()})}}async function Me(e,t,n){let i;for(let r=0;r<t;r++)try{return await e()}catch(o){if(i=o,r<t-1){const a=n*Math.pow(2,r);await new Promise(d=>setTimeout(d,a))}}throw i}function T({projectId:e}){return`${we}/projects/${e}/registrations`}async function I({appConfig:e,installations:t}){const n=await t.getToken();return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":e.apiKey,"x-goog-firebase-installations-auth":`FIS ${n}`})}function Fe(e,t){var n,i;try{if(/^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(e))return new URL(e).host}catch{}try{if(typeof self<"u"&&((n=self.location)!=null&&n.href))return new URL(e,self.location.origin).host}catch{}return typeof self<"u"&&((i=self.location)!=null&&i.host)?self.location.host:t}function D({p256dh:e,auth:t,endpoint:n,vapidKey:i,swScope:r},o,a){const d={web:{origin:Fe(r,o),endpoint:n,auth:t,p256dh:e}};return a&&(d.fcm_sdk_version=m),i!==V&&(d.web.applicationPubKey=i),d}/**
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
 */const Ke=7*24*60*60*1e3;async function Pe(e){const t=await Ue(e.swRegistration,e.vapidKey),n={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:t.endpoint,auth:u(t.getKey("auth")),p256dh:u(t.getKey("p256dh"))},i=await Y(e.firebaseDependencies);if(i){if(Be(i.subscriptionOptions,n))return Date.now()>=i.createTime+Ke?Le(e,{token:i.token,createTime:Date.now(),subscriptionOptions:n}):i.token;try{await ee(e.firebaseDependencies,i.token)}catch(r){console.warn(r)}return B(e.firebaseDependencies,n)}else return B(e.firebaseDependencies,n)}async function He(e,t){await ee(e.firebaseDependencies,t.token),await z(e.firebaseDependencies),await te(e.firebaseDependencies)}async function xe(e){const t=await k(e.firebaseDependencies).catch(()=>{}),n=t==null?void 0:t.fid;n&&await Z(e.firebaseDependencies,n),await te(e.firebaseDependencies),n&&We(e,n)}async function je(e){const t=await Y(e.firebaseDependencies);t?await He(e,t):await xe(e);const n=await e.swRegistration.pushManager.getSubscription();return n?n.unsubscribe():!0}async function Le(e,t){try{const n=await Ne(e.firebaseDependencies,t),i={...t,token:n,createTime:Date.now()};return await R(e.firebaseDependencies,i),n}catch(n){throw n}}async function B(e,t){const i={token:await De(e,t),createTime:Date.now(),subscriptionOptions:t};return await R(e,i),i.token}async function Ue(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:J(t)})}function Be(e,t){const n=t.vapidKey===e.vapidKey,i=t.endpoint===e.endpoint,r=t.auth===e.auth,o=t.p256dh===e.p256dh;return n&&i&&r&&o}async function te(e){try{await X(e)}catch{}}function $e(e,t){const n=e.onRegisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}function We(e,t){const n=e.onUnregisteredHandler;n&&(typeof n=="function"?n(t):n.next(t))}/**
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
 */async function ne(e){try{e.swRegistration=await navigator.serviceWorker.register(pe,{scope:he}),e.swRegistration.update().catch(()=>{}),await Ge(e.swRegistration)}catch(t){throw c.create("failed-service-worker-registration",{browserErrorMessage:t==null?void 0:t.message})}}async function Ge(e){return new Promise((t,n)=>{const i=setTimeout(()=>n(new Error(`Service worker not registered after ${M} ms`)),M),r=e.installing||e.waiting;e.active?(clearTimeout(i),t()):r?r.onstatechange=o=>{var a;((a=o.target)==null?void 0:a.state)==="activated"&&(r.onstatechange=null,clearTimeout(i),t())}:(clearTimeout(i),n(new Error("No incoming service worker found.")))})}/**
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
 */async function ie(e,t){if(!t&&!e.swRegistration&&await ne(e),!(!t&&e.swRegistration)){if(!(t instanceof ServiceWorkerRegistration))throw c.create("invalid-sw-registration");e.swRegistration=t}}/**
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
 */async function re(e,t){t?e.vapidKey=t:e.vapidKey||(e.vapidKey=V)}/**
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
 */const $=3;async function Ve(e,t){const n=await qe(e.swRegistration,e.vapidKey),i={vapidKey:e.vapidKey,swScope:e.swRegistration.scope,endpoint:n.endpoint,auth:u(n.getKey("auth")),p256dh:u(n.getKey("p256dh"))},r=e.firebaseDependencies.installations;for(let o=0;o<$;o++){const{responseFid:a}=await Ae(e.firebaseDependencies,i);if(a===t)return;o<$-1&&await r.getToken(!0)}throw c.create("fid-registration-failed",{errorInfo:"CreateRegistration response FID does not match Firebase Installation ID"})}async function qe(e,t){const n=await e.pushManager.getSubscription();return n||e.pushManager.subscribe({userVisibleOnly:!0,applicationServerKey:J(t)})}/**
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
 */const Je=7*24*60*60*1e3;async function A(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");if(!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");await re(e,t==null?void 0:t.vapidKey),await ie(e,t==null?void 0:t.serviceWorkerRegistration);const n=e._registerNotifyChain.catch(()=>{});return e._registerNotifyChain=n.then(async()=>{const i=await e.firebaseDependencies.installations.getId(),r=await k(e.firebaseDependencies),o=Date.now();if((!r||r.fid!==i||o>=r.lastRegisterTime+Je)&&(await Ve(e,i),await me(e.firebaseDependencies,{fid:i,lastRegisterTime:o,vapidKey:e.vapidKey})),!e.onRegisteredHandler)throw c.create("invalid-on-registered-handler");$e(e,i)}),e._registerNotifyChain}/**
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
 */function Qe(e,t){return le(t,()=>{(async()=>!e.onRegisteredHandler||!await k(e.firebaseDependencies)||await A(e).catch(()=>{}))()})}/**
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
 */function W(e){const t={from:e.from,collapseKey:e.collapse_key,messageId:e.fcmMessageId};return Ye(t,e),ze(t,e),Xe(t,e),t}function Ye(e,t){if(!t.notification)return;e.notification={};const n=t.notification.title;n&&(e.notification.title=n);const i=t.notification.body;i&&(e.notification.body=i);const r=t.notification.image;r&&(e.notification.image=r);const o=t.notification.icon;o&&(e.notification.icon=o)}function ze(e,t){t.data&&(e.data=t.data)}function Xe(e,t){var r,o,a,d;if(!t.fcmOptions&&!((r=t.notification)!=null&&r.click_action))return;e.fcmOptions={};const n=((o=t.fcmOptions)==null?void 0:o.link)??((a=t.notification)==null?void 0:a.click_action);n&&(e.fcmOptions.link=n);const i=(d=t.fcmOptions)==null?void 0:d.analytics_label;i&&(e.fcmOptions.analyticsLabel=i)}/**
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
 */function Ze(e){return typeof e=="object"&&!!e&&q in e}/**
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
 */function et(e){if(!e||!e.options)throw _("App Configuration Object");if(!e.name)throw _("App Name");const t=["projectId","apiKey","appId","messagingSenderId"],{options:n}=e;for(const i of t)if(!n[i])throw _(i);return{appName:e.name,projectId:n.projectId,apiKey:n.apiKey,appId:n.appId,senderId:n.messagingSenderId}}function _(e){return c.create("missing-app-config-values",{valueName:e})}/**
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
 */class tt{constructor(t,n,i){this.deliveryMetricsExportedToBigQueryEnabled=!1,this.onBackgroundMessageHandler=null,this.onMessageHandler=null,this.onRegisteredHandler=null,this.onUnregisteredHandler=null,this._registerNotifyChain=Promise.resolve(),this._fidChangeUnsubscribe=null,this.logEvents=[],this.logQueue={state:"stopped"};const r=et(t);this.firebaseDependencies={app:t,appConfig:r,installations:n,analyticsProvider:i}}_delete(){return this._fidChangeUnsubscribe&&(this._fidChangeUnsubscribe(),this._fidChangeUnsubscribe=null),this.logQueue.state==="scheduled"&&clearTimeout(this.logQueue.timerId),this.logQueue={state:"stopped"},Promise.resolve()}}/**
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
 */async function oe(e,t){if(!navigator)throw c.create("only-available-in-window");if(Notification.permission==="default"&&await Notification.requestPermission(),Notification.permission!=="granted")throw c.create("permission-blocked");return await re(e,t==null?void 0:t.vapidKey),await ie(e,t==null?void 0:t.serviceWorkerRegistration),Pe(e)}/**
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
 */async function nt(e,t,n){const i=it(t);(await e.firebaseDependencies.analyticsProvider.get()).logEvent(i,{message_id:n[q],message_name:n[be],message_time:n[ge],message_device_time:Math.floor(Date.now()/1e3)})}function it(e){switch(e){case w.NOTIFICATION_CLICKED:return"notification_open";case w.PUSH_RECEIVED:return"notification_foreground";default:throw new Error}}/**
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
 */async function rt(e,t){const n=t.data;if(!n.isFirebaseMessaging)return;if(e.onMessageHandler&&n.messageType===w.PUSH_RECEIVED&&(typeof e.onMessageHandler=="function"?e.onMessageHandler(W(n)):e.onMessageHandler.next(W(n))),e.onRegisteredHandler&&n.messageType===w.FID_REGISTERED){const r=n.fid;typeof e.onRegisteredHandler=="function"?e.onRegisteredHandler(r):e.onRegisteredHandler.next(r)}const i=n.data;Ze(i)&&i[ye]==="1"&&await nt(e,n.messageType,i)}/**
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
 */const ot=e=>{const t=new tt(e.getProvider("app").getImmediate(),e.getProvider("installations-internal").getImmediate(),e.getProvider("analytics-internal"));return navigator.serviceWorker.addEventListener("message",n=>rt(t,n)),t._fidChangeUnsubscribe=Qe(t,e.getProvider("installations").getImmediate()),t},at=e=>{const t=e.getProvider("messaging").getImmediate();return{getToken:i=>oe(t,i),register:i=>A(t,i)}};function st(){C(new O("messaging",ot,"PUBLIC")),C(new O("messaging-internal",at,"PRIVATE")),N(L,m),N(L,m,"esm2020")}/**
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
 */async function ct(){try{await de()}catch{return!1}return typeof window<"u"&&ue()&&fe()&&"serviceWorker"in navigator&&"PushManager"in window&&"Notification"in window&&"fetch"in window&&ServiceWorkerRegistration.prototype.hasOwnProperty("showNotification")&&PushSubscription.prototype.hasOwnProperty("getKey")}/**
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
 */async function dt(e){if(!navigator)throw c.create("only-available-in-window");return e.swRegistration||await ne(e),je(e)}/**
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
 */function ut(e,t){if(!navigator)throw c.create("only-available-in-window");return e.onMessageHandler=t,()=>{e.onMessageHandler=null}}/**
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
 */function ft(e,t){return e.onRegisteredHandler=t,()=>{e.onRegisteredHandler===t&&(e.onRegisteredHandler=null)}}/**
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
 */function lt(e,t){return e.onUnregisteredHandler=t,()=>{e.onUnregisteredHandler===t&&(e.onUnregisteredHandler=null)}}/**
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
 */async function pt(e){if(!navigator)throw c.create("only-available-in-window");const t=await k(e.firebaseDependencies).catch(()=>{}),n=(t==null?void 0:t.fid)??await e.firebaseDependencies.installations.getId();await Z(e.firebaseDependencies,n);try{await X(e.firebaseDependencies)}catch{}try{await z(e.firebaseDependencies)}catch{}const i=e.onUnregisteredHandler;i&&(typeof i=="function"?i(n):i.next(n))}/**
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
 */function wt(e=ce()){return ct().then(t=>{if(!t)throw c.create("unsupported-browser")},t=>{throw c.create("indexed-db-unsupported")}),se(p(e),"messaging").getImmediate()}async function bt(e,t){return e=p(e),oe(e,t)}function gt(e){return e=p(e),dt(e)}function yt(e,t){return e=p(e),ut(e,t)}async function Tt(e,t){return e=p(e),A(e,t)}async function It(e){return e=p(e),pt(e)}function vt(e,t){return e=p(e),ft(e,t)}function kt(e,t){return e=p(e),lt(e,t)}/**
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
 */st();export{gt as deleteToken,wt as getMessaging,bt as getToken,ct as isSupported,yt as onMessage,vt as onRegistered,kt as onUnregistered,Tt as register,It as unregister};
