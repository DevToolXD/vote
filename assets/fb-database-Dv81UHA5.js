import{L as Fs,J as f,o as Ws,C as Us,r as Dn,K as b,N as Zt,O as H,P as ge,Q as it,R as Vs,T as Gs,U as Bs,V as Ye,Y as me,_ as Hs,a as qs,G as q,z as Qs,Z as Ys,$ as Ks,a0 as Ut,t as mi,u as zs,n as B,a1 as js,a2 as yt,a3 as $s,a4 as Xs,b as Js,a5 as Zs,a6 as er,d as tr,a7 as nr,i as yi,p as ir,q as sr}from"./fb-core-C18BJ22g.js";var On={};const Mn="@firebase/database",Ln="1.1.5";/**
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
 */let vi="";function rr(n){vi=n}/**
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
 */class or{constructor(e){this.domStorage_=e,this.prefix_="firebase:"}set(e,t){t==null?this.domStorage_.removeItem(this.prefixedName_(e)):this.domStorage_.setItem(this.prefixedName_(e),b(t))}get(e){const t=this.domStorage_.getItem(this.prefixedName_(e));return t==null?null:Zt(t)}remove(e){this.domStorage_.removeItem(this.prefixedName_(e))}prefixedName_(e){return this.prefix_+e}toString(){return this.domStorage_.toString()}}/**
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
 */class lr{constructor(){this.cache_={},this.isInMemoryStorage=!0}set(e,t){t==null?delete this.cache_[e]:this.cache_[e]=t}get(e){return H(this.cache_,e)?this.cache_[e]:null}remove(e){delete this.cache_[e]}}/**
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
 */const Ci=function(n){try{if(typeof window<"u"&&typeof window[n]<"u"){const e=window[n];return e.setItem("firebase:sentinel","cache"),e.removeItem("firebase:sentinel"),new or(e)}}catch{}return new lr},oe=Ci("localStorage"),ar=Ci("sessionStorage");/**
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
 */const pe=new Fs("@firebase/database"),cr=function(){let n=1;return function(){return n++}}(),Ei=function(n){const e=Vs(n),t=new Gs;t.update(e);const i=t.digest();return Bs.encodeByteArray(i)},Ke=function(...n){let e="";for(let t=0;t<n.length;t++){const i=n[t];Array.isArray(i)||i&&typeof i=="object"&&typeof i.length=="number"?e+=Ke.apply(null,i):typeof i=="object"?e+=b(i):e+=i,e+=" "}return e};let xe=null,Fn=!0;const hr=function(n,e){f(!0,"Can't turn on custom loggers persistently."),pe.logLevel=qs.VERBOSE,xe=pe.log.bind(pe)},x=function(...n){if(Fn===!0&&(Fn=!1,xe===null&&ar.get("logging_enabled")===!0&&hr()),xe){const e=Ke.apply(null,n);xe(e)}},ze=function(n){return function(...e){x(n,...e)}},Vt=function(...n){const e="FIREBASE INTERNAL ERROR: "+Ke(...n);pe.error(e)},z=function(...n){const e=`FIREBASE FATAL ERROR: ${Ke(...n)}`;throw pe.error(e),new Error(e)},M=function(...n){const e="FIREBASE WARNING: "+Ke(...n);pe.warn(e)},ur=function(){typeof window<"u"&&window.location&&window.location.protocol&&window.location.protocol.indexOf("https:")!==-1&&M("Insecure Firebase access from a secure page. Please use https in calls to new Firebase().")},vt=function(n){return typeof n=="number"&&(n!==n||n===Number.POSITIVE_INFINITY||n===Number.NEGATIVE_INFINITY)},dr=function(n){if(document.readyState==="complete")n();else{let e=!1;const t=function(){if(!document.body){setTimeout(t,Math.floor(10));return}e||(e=!0,n())};document.addEventListener?(document.addEventListener("DOMContentLoaded",t,!1),window.addEventListener("load",t,!1)):document.attachEvent&&(document.attachEvent("onreadystatechange",()=>{document.readyState==="complete"&&t()}),window.attachEvent("onload",t))}},Z="[MIN_NAME]",ee="[MAX_NAME]",he=function(n,e){if(n===e)return 0;if(n===Z||e===ee)return-1;if(e===Z||n===ee)return 1;{const t=Wn(n),i=Wn(e);return t!==null?i!==null?t-i===0?n.length-e.length:t-i:-1:i!==null?1:n<e?-1:1}},fr=function(n,e){return n===e?0:n<e?-1:1},Re=function(n,e){if(e&&n in e)return e[n];throw new Error("Missing required key ("+n+") in object: "+b(e))},en=function(n){if(typeof n!="object"||n===null)return b(n);const e=[];for(const i in n)e.push(i);e.sort();let t="{";for(let i=0;i<e.length;i++)i!==0&&(t+=","),t+=b(e[i]),t+=":",t+=en(n[e[i]]);return t+="}",t},wi=function(n,e){const t=n.length;if(t<=e)return[n];const i=[];for(let s=0;s<t;s+=e)s+e>t?i.push(n.substring(s,t)):i.push(n.substring(s,s+e));return i};function A(n,e){for(const t in n)n.hasOwnProperty(t)&&e(t,n[t])}const Ii=function(n){f(!vt(n),"Invalid JSON number");const e=11,t=52,i=(1<<e-1)-1;let s,r,o,l,a;n===0?(r=0,o=0,s=1/n===-1/0?1:0):(s=n<0,n=Math.abs(n),n>=Math.pow(2,1-i)?(l=Math.min(Math.floor(Math.log(n)/Math.LN2),i),r=l+i,o=Math.round(n*Math.pow(2,t-l)-Math.pow(2,t))):(r=0,o=Math.round(n/Math.pow(2,1-i-t))));const c=[];for(a=t;a;a-=1)c.push(o%2?1:0),o=Math.floor(o/2);for(a=e;a;a-=1)c.push(r%2?1:0),r=Math.floor(r/2);c.push(s?1:0),c.reverse();const h=c.join("");let u="";for(a=0;a<64;a+=8){let d=parseInt(h.substr(a,8),2).toString(16);d.length===1&&(d="0"+d),u=u+d}return u.toLowerCase()},_r=function(){return!!(typeof window=="object"&&window.chrome&&window.chrome.extension&&!/^chrome/.test(window.location.href))},pr=function(){return typeof Windows=="object"&&typeof Windows.UI=="object"};function gr(n,e){let t="Unknown Error";n==="too_big"?t="The data requested exceeds the maximum size that can be accessed with a single request.":n==="permission_denied"?t="Client doesn't have permission to access the desired data.":n==="unavailable"&&(t="The service is unavailable");const i=new Error(n+" at "+e._path.toString()+": "+t);return i.code=n.toUpperCase(),i}const mr=new RegExp("^-?(0*)\\d{1,10}$"),yr=-2147483648,vr=2147483647,Wn=function(n){if(mr.test(n)){const e=Number(n);if(e>=yr&&e<=vr)return e}return null},we=function(n){try{n()}catch(e){setTimeout(()=>{const t=e.stack||"";throw M("Exception was thrown by user callback.",t),e},Math.floor(0))}},Cr=function(){return(typeof window=="object"&&window.navigator&&window.navigator.userAgent||"").search(/googlebot|google webmaster tools|bingbot|yahoo! slurp|baiduspider|yandexbot|duckduckbot/i)>=0},Ae=function(n,e){const t=setTimeout(n,e);return typeof t=="number"&&typeof Deno<"u"&&Deno.unrefTimer?Deno.unrefTimer(t):typeof t=="object"&&t.unref&&t.unref(),t};/**
 * @license
 * Copyright 2021 Google LLC
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
 */class Er{constructor(e,t){this.appCheckProvider=t,this.appName=e.name,Hs(e)&&e.settings.appCheckToken&&(this.serverAppAppCheckToken=e.settings.appCheckToken),this.appCheck=t==null?void 0:t.getImmediate({optional:!0}),this.appCheck||t==null||t.get().then(i=>this.appCheck=i)}getToken(e){if(this.serverAppAppCheckToken){if(e)throw new Error("Attempted reuse of `FirebaseServerApp.appCheckToken` after previous usage failed.");return Promise.resolve({token:this.serverAppAppCheckToken})}return this.appCheck?this.appCheck.getToken(e):new Promise((t,i)=>{setTimeout(()=>{this.appCheck?this.getToken(e).then(t,i):t(null)},0)})}addTokenChangeListener(e){var t;(t=this.appCheckProvider)==null||t.get().then(i=>i.addTokenListener(e))}notifyForInvalidToken(){M(`Provided AppCheck credentials for the app named "${this.appName}" are invalid. This usually indicates your app was not initialized correctly.`)}}/**
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
 */class wr{constructor(e,t,i){this.appName_=e,this.firebaseOptions_=t,this.authProvider_=i,this.auth_=null,this.auth_=i.getImmediate({optional:!0}),this.auth_||i.onInit(s=>this.auth_=s)}getToken(e){return this.auth_?this.auth_.getToken(e).catch(t=>t&&t.code==="auth/token-not-initialized"?(x("Got auth/token-not-initialized error.  Treating as null token."),null):Promise.reject(t)):new Promise((t,i)=>{setTimeout(()=>{this.auth_?this.getToken(e).then(t,i):t(null)},0)})}addTokenChangeListener(e){this.auth_?this.auth_.addAuthTokenListener(e):this.authProvider_.get().then(t=>t.addAuthTokenListener(e))}removeTokenChangeListener(e){this.authProvider_.get().then(t=>t.removeAuthTokenListener(e))}notifyForInvalidToken(){let e='Provided authentication credentials for the app named "'+this.appName_+'" are invalid. This usually indicates your app was not initialized correctly. ';"credential"in this.firebaseOptions_?e+='Make sure the "credential" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':"serviceAccount"in this.firebaseOptions_?e+='Make sure the "serviceAccount" property provided to initializeApp() is authorized to access the specified "databaseURL" and is from the correct project.':e+='Make sure the "apiKey" and "databaseURL" properties provided to initializeApp() match the values provided for your app at https://console.firebase.google.com/.',M(e)}}class nt{constructor(e){this.accessToken=e}getToken(e){return Promise.resolve({accessToken:this.accessToken})}addTokenChangeListener(e){e(this.accessToken)}removeTokenChangeListener(e){}notifyForInvalidToken(){}}nt.OWNER="owner";/**
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
 */const tn="5",Ti="v",Si="s",Ni="r",Ri="f",bi=/(console\.firebase|firebase-console-\w+\.corp|firebase\.corp)\.google\.com/,ki="ls",Pi="p",Gt="ac",xi="websocket",Ai="long_polling";/**
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
 */class Di{constructor(e,t,i,s,r=!1,o="",l=!1,a=!1,c=null){this.secure=t,this.namespace=i,this.webSocketOnly=s,this.nodeAdmin=r,this.persistenceKey=o,this.includeNamespaceInQueryParams=l,this.isUsingEmulator=a,this.emulatorOptions=c,this._host=e.toLowerCase(),this._domain=this._host.substr(this._host.indexOf(".")+1),this.internalHost=oe.get("host:"+e)||this._host}isCacheableHost(){return this.internalHost.substr(0,2)==="s-"}isCustomHost(){return this._domain!=="firebaseio.com"&&this._domain!=="firebaseio-demo.com"}get host(){return this._host}set host(e){e!==this.internalHost&&(this.internalHost=e,this.isCacheableHost()&&oe.set("host:"+this._host,this.internalHost))}toString(){let e=this.toURLString();return this.persistenceKey&&(e+="<"+this.persistenceKey+">"),e}toURLString(){const e=this.secure?"https://":"http://",t=this.includeNamespaceInQueryParams?`?ns=${this.namespace}`:"";return`${e}${this.host}/${t}`}}function Ir(n){return n.host!==n.internalHost||n.isCustomHost()||n.includeNamespaceInQueryParams}function Oi(n,e,t){f(typeof e=="string","typeof type must == string"),f(typeof t=="object","typeof params must == object");let i;if(e===xi)i=(n.secure?"wss://":"ws://")+n.internalHost+"/.ws?";else if(e===Ai)i=(n.secure?"https://":"http://")+n.internalHost+"/.lp?";else throw new Error("Unknown connection type: "+e);Ir(n)&&(t.ns=n.namespace);const s=[];return A(t,(r,o)=>{s.push(r+"="+o)}),i+s.join("&")}/**
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
 */class Tr{constructor(){this.counters_={}}incrementCounter(e,t=1){H(this.counters_,e)||(this.counters_[e]=0),this.counters_[e]+=t}get(){return js(this.counters_)}}/**
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
 */const At={},Dt={};function nn(n){const e=n.toString();return At[e]||(At[e]=new Tr),At[e]}function Sr(n,e){const t=n.toString();return Dt[t]||(Dt[t]=e()),Dt[t]}/**
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
 */class Nr{constructor(e){this.onMessage_=e,this.pendingResponses=[],this.currentResponseNum=0,this.closeAfterResponse=-1,this.onClose=null}closeAfter(e,t){this.closeAfterResponse=e,this.onClose=t,this.closeAfterResponse<this.currentResponseNum&&(this.onClose(),this.onClose=null)}handleResponse(e,t){for(this.pendingResponses[e]=t;this.pendingResponses[this.currentResponseNum];){const i=this.pendingResponses[this.currentResponseNum];delete this.pendingResponses[this.currentResponseNum];for(let s=0;s<i.length;++s)i[s]&&we(()=>{this.onMessage_(i[s])});if(this.currentResponseNum===this.closeAfterResponse){this.onClose&&(this.onClose(),this.onClose=null);break}this.currentResponseNum++}}}/**
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
 */const Un="start",Rr="close",br="pLPCommand",kr="pRTLPCB",Mi="id",Li="pw",Fi="ser",Pr="cb",xr="seg",Ar="ts",Dr="d",Or="dframe",Wi=1870,Ui=30,Mr=Wi-Ui,Lr=25e3,Fr=3e4;class _e{constructor(e,t,i,s,r,o,l){this.connId=e,this.repoInfo=t,this.applicationId=i,this.appCheckToken=s,this.authToken=r,this.transportSessionId=o,this.lastSessionId=l,this.bytesSent=0,this.bytesReceived=0,this.everConnected_=!1,this.log_=ze(e),this.stats_=nn(t),this.urlFn=a=>(this.appCheckToken&&(a[Gt]=this.appCheckToken),Oi(t,Ai,a))}open(e,t){this.curSegmentNum=0,this.onDisconnect_=t,this.myPacketOrderer=new Nr(e),this.isClosed_=!1,this.connectTimeoutTimer_=setTimeout(()=>{this.log_("Timed out trying to connect."),this.onClosed_(),this.connectTimeoutTimer_=null},Math.floor(Fr)),dr(()=>{if(this.isClosed_)return;this.scriptTagHolder=new sn((...r)=>{const[o,l,a,c,h]=r;if(this.incrementIncomingBytes_(r),!!this.scriptTagHolder)if(this.connectTimeoutTimer_&&(clearTimeout(this.connectTimeoutTimer_),this.connectTimeoutTimer_=null),this.everConnected_=!0,o===Un)this.id=l,this.password=a;else if(o===Rr)l?(this.scriptTagHolder.sendNewPolls=!1,this.myPacketOrderer.closeAfter(l,()=>{this.onClosed_()})):this.onClosed_();else throw new Error("Unrecognized command received: "+o)},(...r)=>{const[o,l]=r;this.incrementIncomingBytes_(r),this.myPacketOrderer.handleResponse(o,l)},()=>{this.onClosed_()},this.urlFn);const i={};i[Un]="t",i[Fi]=Math.floor(Math.random()*1e8),this.scriptTagHolder.uniqueCallbackIdentifier&&(i[Pr]=this.scriptTagHolder.uniqueCallbackIdentifier),i[Ti]=tn,this.transportSessionId&&(i[Si]=this.transportSessionId),this.lastSessionId&&(i[ki]=this.lastSessionId),this.applicationId&&(i[Pi]=this.applicationId),this.appCheckToken&&(i[Gt]=this.appCheckToken),typeof location<"u"&&location.hostname&&bi.test(location.hostname)&&(i[Ni]=Ri);const s=this.urlFn(i);this.log_("Connecting via long-poll to "+s),this.scriptTagHolder.addTag(s,()=>{})})}start(){this.scriptTagHolder.startLongPoll(this.id,this.password),this.addDisconnectPingFrame(this.id,this.password)}static forceAllow(){_e.forceAllow_=!0}static forceDisallow(){_e.forceDisallow_=!0}static isAvailable(){return _e.forceAllow_?!0:!_e.forceDisallow_&&typeof document<"u"&&document.createElement!=null&&!_r()&&!pr()}markConnectionHealthy(){}shutdown_(){this.isClosed_=!0,this.scriptTagHolder&&(this.scriptTagHolder.close(),this.scriptTagHolder=null),this.myDisconnFrame&&(document.body.removeChild(this.myDisconnFrame),this.myDisconnFrame=null),this.connectTimeoutTimer_&&(clearTimeout(this.connectTimeoutTimer_),this.connectTimeoutTimer_=null)}onClosed_(){this.isClosed_||(this.log_("Longpoll is closing itself"),this.shutdown_(),this.onDisconnect_&&(this.onDisconnect_(this.everConnected_),this.onDisconnect_=null))}close(){this.isClosed_||(this.log_("Longpoll is being closed."),this.shutdown_())}send(e){const t=b(e);this.bytesSent+=t.length,this.stats_.incrementCounter("bytes_sent",t.length);const i=$s(t),s=wi(i,Mr);for(let r=0;r<s.length;r++)this.scriptTagHolder.enqueueSegment(this.curSegmentNum,s.length,s[r]),this.curSegmentNum++}addDisconnectPingFrame(e,t){this.myDisconnFrame=document.createElement("iframe");const i={};i[Or]="t",i[Mi]=e,i[Li]=t,this.myDisconnFrame.src=this.urlFn(i),this.myDisconnFrame.style.display="none",document.body.appendChild(this.myDisconnFrame)}incrementIncomingBytes_(e){const t=b(e).length;this.bytesReceived+=t,this.stats_.incrementCounter("bytes_received",t)}}class sn{constructor(e,t,i,s){this.onDisconnect=i,this.urlFn=s,this.outstandingRequests=new Set,this.pendingSegs=[],this.currentSerial=Math.floor(Math.random()*1e8),this.sendNewPolls=!0;{this.uniqueCallbackIdentifier=cr(),window[br+this.uniqueCallbackIdentifier]=e,window[kr+this.uniqueCallbackIdentifier]=t,this.myIFrame=sn.createIFrame_();let r="";this.myIFrame.src&&this.myIFrame.src.substr(0,11)==="javascript:"&&(r='<script>document.domain="'+document.domain+'";<\/script>');const o="<html><body>"+r+"</body></html>";try{this.myIFrame.doc.open(),this.myIFrame.doc.write(o),this.myIFrame.doc.close()}catch(l){x("frame writing exception"),l.stack&&x(l.stack),x(l)}}}static createIFrame_(){const e=document.createElement("iframe");if(e.style.display="none",document.body){document.body.appendChild(e);try{e.contentWindow.document||x("No IE domain setting required")}catch{const i=document.domain;e.src="javascript:void((function(){document.open();document.domain='"+i+"';document.close();})())"}}else throw"Document body has not initialized. Wait to initialize Firebase until after the document is ready.";return e.contentDocument?e.doc=e.contentDocument:e.contentWindow?e.doc=e.contentWindow.document:e.document&&(e.doc=e.document),e}close(){this.alive=!1,this.myIFrame&&(this.myIFrame.doc.body.textContent="",setTimeout(()=>{this.myIFrame!==null&&(document.body.removeChild(this.myIFrame),this.myIFrame=null)},Math.floor(0)));const e=this.onDisconnect;e&&(this.onDisconnect=null,e())}startLongPoll(e,t){for(this.myID=e,this.myPW=t,this.alive=!0;this.newRequest_(););}newRequest_(){if(this.alive&&this.sendNewPolls&&this.outstandingRequests.size<(this.pendingSegs.length>0?2:1)){this.currentSerial++;const e={};e[Mi]=this.myID,e[Li]=this.myPW,e[Fi]=this.currentSerial;let t=this.urlFn(e),i="",s=0;for(;this.pendingSegs.length>0&&this.pendingSegs[0].d.length+Ui+i.length<=Wi;){const o=this.pendingSegs.shift();i=i+"&"+xr+s+"="+o.seg+"&"+Ar+s+"="+o.ts+"&"+Dr+s+"="+o.d,s++}return t=t+i,this.addLongPollTag_(t,this.currentSerial),!0}else return!1}enqueueSegment(e,t,i){this.pendingSegs.push({seg:e,ts:t,d:i}),this.alive&&this.newRequest_()}addLongPollTag_(e,t){this.outstandingRequests.add(t);const i=()=>{this.outstandingRequests.delete(t),this.newRequest_()},s=setTimeout(i,Math.floor(Lr)),r=()=>{clearTimeout(s),i()};this.addTag(e,r)}addTag(e,t){setTimeout(()=>{try{if(!this.sendNewPolls)return;const i=this.myIFrame.doc.createElement("script");i.type="text/javascript",i.async=!0,i.src=e,i.onload=i.onreadystatechange=function(){const s=i.readyState;(!s||s==="loaded"||s==="complete")&&(i.onload=i.onreadystatechange=null,i.parentNode&&i.parentNode.removeChild(i),t())},i.onerror=()=>{x("Long-poll script failed to load: "+e),this.sendNewPolls=!1,this.close()},this.myIFrame.doc.body.appendChild(i)}catch{}},Math.floor(1))}}/**
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
 */const Wr=16384,Ur=45e3;let st=null;typeof MozWebSocket<"u"?st=MozWebSocket:typeof WebSocket<"u"&&(st=WebSocket);class U{constructor(e,t,i,s,r,o,l){this.connId=e,this.applicationId=i,this.appCheckToken=s,this.authToken=r,this.keepaliveTimer=null,this.frames=null,this.totalFrames=0,this.bytesSent=0,this.bytesReceived=0,this.log_=ze(this.connId),this.stats_=nn(t),this.connURL=U.connectionURL_(t,o,l,s,i),this.nodeAdmin=t.nodeAdmin}static connectionURL_(e,t,i,s,r){const o={};return o[Ti]=tn,typeof location<"u"&&location.hostname&&bi.test(location.hostname)&&(o[Ni]=Ri),t&&(o[Si]=t),i&&(o[ki]=i),s&&(o[Gt]=s),r&&(o[Pi]=r),Oi(e,xi,o)}open(e,t){this.onDisconnect=t,this.onMessage=e,this.log_("Websocket connecting to "+this.connURL),this.everConnected_=!1,oe.set("previous_websocket_failure",!0);try{let i;Xs(),this.mySock=new st(this.connURL,[],i)}catch(i){this.log_("Error instantiating WebSocket.");const s=i.message||i.data;s&&this.log_(s),this.onClosed_();return}this.mySock.onopen=()=>{this.log_("Websocket connected."),this.everConnected_=!0},this.mySock.onclose=()=>{this.log_("Websocket connection was disconnected."),this.mySock=null,this.onClosed_()},this.mySock.onmessage=i=>{this.handleIncomingFrame(i)},this.mySock.onerror=i=>{this.log_("WebSocket error.  Closing connection.");const s=i.message||i.data;s&&this.log_(s),this.onClosed_()}}start(){}static forceDisallow(){U.forceDisallow_=!0}static isAvailable(){let e=!1;if(typeof navigator<"u"&&navigator.userAgent){const t=/Android ([0-9]{0,}\.[0-9]{0,})/,i=navigator.userAgent.match(t);i&&i.length>1&&parseFloat(i[1])<4.4&&(e=!0)}return!e&&st!==null&&!U.forceDisallow_}static previouslyFailed(){return oe.isInMemoryStorage||oe.get("previous_websocket_failure")===!0}markConnectionHealthy(){oe.remove("previous_websocket_failure")}appendFrame_(e){if(this.frames.push(e),this.frames.length===this.totalFrames){const t=this.frames.join("");this.frames=null;const i=Zt(t);this.onMessage(i)}}handleNewFrameCount_(e){this.totalFrames=e,this.frames=[]}extractFrameCount_(e){if(f(this.frames===null,"We already have a frame buffer"),e.length<=6){const t=Number(e);if(!isNaN(t))return this.handleNewFrameCount_(t),null}return this.handleNewFrameCount_(1),e}handleIncomingFrame(e){if(this.mySock===null)return;const t=e.data;if(this.bytesReceived+=t.length,this.stats_.incrementCounter("bytes_received",t.length),this.resetKeepAlive(),this.frames!==null)this.appendFrame_(t);else{const i=this.extractFrameCount_(t);i!==null&&this.appendFrame_(i)}}send(e){this.resetKeepAlive();const t=b(e);this.bytesSent+=t.length,this.stats_.incrementCounter("bytes_sent",t.length);const i=wi(t,Wr);i.length>1&&this.sendString_(String(i.length));for(let s=0;s<i.length;s++)this.sendString_(i[s])}shutdown_(){this.isClosed_=!0,this.keepaliveTimer&&(clearInterval(this.keepaliveTimer),this.keepaliveTimer=null),this.mySock&&(this.mySock.close(),this.mySock=null)}onClosed_(){this.isClosed_||(this.log_("WebSocket is closing itself"),this.shutdown_(),this.onDisconnect&&(this.onDisconnect(this.everConnected_),this.onDisconnect=null))}close(){this.isClosed_||(this.log_("WebSocket is being closed"),this.shutdown_())}resetKeepAlive(){clearInterval(this.keepaliveTimer),this.keepaliveTimer=setInterval(()=>{this.mySock&&this.sendString_("0"),this.resetKeepAlive()},Math.floor(Ur))}sendString_(e){try{this.mySock.send(e)}catch(t){this.log_("Exception thrown from WebSocket.send():",t.message||t.data,"Closing connection."),setTimeout(this.onClosed_.bind(this),0)}}}U.responsesRequiredToBeHealthy=2;U.healthyTimeout=3e4;/**
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
 */class Le{static get ALL_TRANSPORTS(){return[_e,U]}static get IS_TRANSPORT_INITIALIZED(){return this.globalTransportInitialized_}constructor(e){this.initTransports_(e)}initTransports_(e){const t=U&&U.isAvailable();let i=t&&!U.previouslyFailed();if(e.webSocketOnly&&(t||M("wss:// URL used, but browser isn't known to support websockets.  Trying anyway."),i=!0),i)this.transports_=[U];else{const s=this.transports_=[];for(const r of Le.ALL_TRANSPORTS)r&&r.isAvailable()&&s.push(r);Le.globalTransportInitialized_=!0}}initialTransport(){if(this.transports_.length>0)return this.transports_[0];throw new Error("No transports available")}upgradeTransport(){return this.transports_.length>1?this.transports_[1]:null}}Le.globalTransportInitialized_=!1;/**
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
 */const Vr=6e4,Gr=5e3,Br=10*1024,Hr=100*1024,Ot="t",Vn="d",qr="s",Gn="r",Qr="e",Bn="o",Hn="a",qn="n",Qn="p",Yr="h";class Kr{constructor(e,t,i,s,r,o,l,a,c,h){this.id=e,this.repoInfo_=t,this.applicationId_=i,this.appCheckToken_=s,this.authToken_=r,this.onMessage_=o,this.onReady_=l,this.onDisconnect_=a,this.onKill_=c,this.lastSessionId=h,this.connectionCount=0,this.pendingDataMessages=[],this.state_=0,this.log_=ze("c:"+this.id+":"),this.transportManager_=new Le(t),this.log_("Connection created"),this.start_()}start_(){const e=this.transportManager_.initialTransport();this.conn_=new e(this.nextTransportId_(),this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,null,this.lastSessionId),this.primaryResponsesRequired_=e.responsesRequiredToBeHealthy||0;const t=this.connReceiver_(this.conn_),i=this.disconnReceiver_(this.conn_);this.tx_=this.conn_,this.rx_=this.conn_,this.secondaryConn_=null,this.isHealthy_=!1,setTimeout(()=>{this.conn_&&this.conn_.open(t,i)},Math.floor(0));const s=e.healthyTimeout||0;s>0&&(this.healthyTimeout_=Ae(()=>{this.healthyTimeout_=null,this.isHealthy_||(this.conn_&&this.conn_.bytesReceived>Hr?(this.log_("Connection exceeded healthy timeout but has received "+this.conn_.bytesReceived+" bytes.  Marking connection healthy."),this.isHealthy_=!0,this.conn_.markConnectionHealthy()):this.conn_&&this.conn_.bytesSent>Br?this.log_("Connection exceeded healthy timeout but has sent "+this.conn_.bytesSent+" bytes.  Leaving connection alive."):(this.log_("Closing unhealthy connection after timeout."),this.close()))},Math.floor(s)))}nextTransportId_(){return"c:"+this.id+":"+this.connectionCount++}disconnReceiver_(e){return t=>{e===this.conn_?this.onConnectionLost_(t):e===this.secondaryConn_?(this.log_("Secondary connection lost."),this.onSecondaryConnectionLost_()):this.log_("closing an old connection")}}connReceiver_(e){return t=>{this.state_!==2&&(e===this.rx_?this.onPrimaryMessageReceived_(t):e===this.secondaryConn_?this.onSecondaryMessageReceived_(t):this.log_("message on old connection"))}}sendRequest(e){const t={t:"d",d:e};this.sendData_(t)}tryCleanupConnection(){this.tx_===this.secondaryConn_&&this.rx_===this.secondaryConn_&&(this.log_("cleaning up and promoting a connection: "+this.secondaryConn_.connId),this.conn_=this.secondaryConn_,this.secondaryConn_=null)}onSecondaryControl_(e){if(Ot in e){const t=e[Ot];t===Hn?this.upgradeIfSecondaryHealthy_():t===Gn?(this.log_("Got a reset on secondary, closing it"),this.secondaryConn_.close(),(this.tx_===this.secondaryConn_||this.rx_===this.secondaryConn_)&&this.close()):t===Bn&&(this.log_("got pong on secondary."),this.secondaryResponsesRequired_--,this.upgradeIfSecondaryHealthy_())}}onSecondaryMessageReceived_(e){const t=Re("t",e),i=Re("d",e);if(t==="c")this.onSecondaryControl_(i);else if(t==="d")this.pendingDataMessages.push(i);else throw new Error("Unknown protocol layer: "+t)}upgradeIfSecondaryHealthy_(){this.secondaryResponsesRequired_<=0?(this.log_("Secondary connection is healthy."),this.isHealthy_=!0,this.secondaryConn_.markConnectionHealthy(),this.proceedWithUpgrade_()):(this.log_("sending ping on secondary."),this.secondaryConn_.send({t:"c",d:{t:Qn,d:{}}}))}proceedWithUpgrade_(){this.secondaryConn_.start(),this.log_("sending client ack on secondary"),this.secondaryConn_.send({t:"c",d:{t:Hn,d:{}}}),this.log_("Ending transmission on primary"),this.conn_.send({t:"c",d:{t:qn,d:{}}}),this.tx_=this.secondaryConn_,this.tryCleanupConnection()}onPrimaryMessageReceived_(e){const t=Re("t",e),i=Re("d",e);t==="c"?this.onControl_(i):t==="d"&&this.onDataMessage_(i)}onDataMessage_(e){this.onPrimaryResponse_(),this.onMessage_(e)}onPrimaryResponse_(){this.isHealthy_||(this.primaryResponsesRequired_--,this.primaryResponsesRequired_<=0&&(this.log_("Primary connection is healthy."),this.isHealthy_=!0,this.conn_.markConnectionHealthy()))}onControl_(e){const t=Re(Ot,e);if(Vn in e){const i=e[Vn];if(t===Yr){const s={...i};this.repoInfo_.isUsingEmulator&&(s.h=this.repoInfo_.host),this.onHandshake_(s)}else if(t===qn){this.log_("recvd end transmission on primary"),this.rx_=this.secondaryConn_;for(let s=0;s<this.pendingDataMessages.length;++s)this.onDataMessage_(this.pendingDataMessages[s]);this.pendingDataMessages=[],this.tryCleanupConnection()}else t===qr?this.onConnectionShutdown_(i):t===Gn?this.onReset_(i):t===Qr?Vt("Server Error: "+i):t===Bn?(this.log_("got pong on primary."),this.onPrimaryResponse_(),this.sendPingOnPrimaryIfNecessary_()):Vt("Unknown control packet command: "+t)}}onHandshake_(e){const t=e.ts,i=e.v,s=e.h;this.sessionId=e.s,this.repoInfo_.host=s,this.state_===0&&(this.conn_.start(),this.onConnectionEstablished_(this.conn_,t),tn!==i&&M("Protocol version mismatch detected"),this.tryStartUpgrade_())}tryStartUpgrade_(){const e=this.transportManager_.upgradeTransport();e&&this.startUpgrade_(e)}startUpgrade_(e){this.secondaryConn_=new e(this.nextTransportId_(),this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,this.sessionId),this.secondaryResponsesRequired_=e.responsesRequiredToBeHealthy||0;const t=this.connReceiver_(this.secondaryConn_),i=this.disconnReceiver_(this.secondaryConn_);this.secondaryConn_.open(t,i),Ae(()=>{this.secondaryConn_&&(this.log_("Timed out trying to upgrade."),this.secondaryConn_.close())},Math.floor(Vr))}onReset_(e){this.log_("Reset packet received.  New host: "+e),this.repoInfo_.host=e,this.state_===1?this.close():(this.closeConnections_(),this.start_())}onConnectionEstablished_(e,t){this.log_("Realtime connection established."),this.conn_=e,this.state_=1,this.onReady_&&(this.onReady_(t,this.sessionId),this.onReady_=null),this.primaryResponsesRequired_===0?(this.log_("Primary connection is healthy."),this.isHealthy_=!0):Ae(()=>{this.sendPingOnPrimaryIfNecessary_()},Math.floor(Gr))}sendPingOnPrimaryIfNecessary_(){!this.isHealthy_&&this.state_===1&&(this.log_("sending ping on primary."),this.sendData_({t:"c",d:{t:Qn,d:{}}}))}onSecondaryConnectionLost_(){const e=this.secondaryConn_;this.secondaryConn_=null,(this.tx_===e||this.rx_===e)&&this.close()}onConnectionLost_(e){this.conn_=null,!e&&this.state_===0?(this.log_("Realtime connection failed."),this.repoInfo_.isCacheableHost()&&(oe.remove("host:"+this.repoInfo_.host),this.repoInfo_.internalHost=this.repoInfo_.host)):this.state_===1&&this.log_("Realtime connection lost."),this.close()}onConnectionShutdown_(e){this.log_("Connection shutdown command received. Shutting down..."),this.onKill_&&(this.onKill_(e),this.onKill_=null),this.onDisconnect_=null,this.close()}sendData_(e){if(this.state_!==1)throw"Connection is not connected";this.tx_.send(e)}close(){this.state_!==2&&(this.log_("Closing realtime connection."),this.state_=2,this.closeConnections_(),this.onDisconnect_&&(this.onDisconnect_(),this.onDisconnect_=null))}closeConnections_(){this.log_("Shutting down all connections"),this.conn_&&(this.conn_.close(),this.conn_=null),this.secondaryConn_&&(this.secondaryConn_.close(),this.secondaryConn_=null),this.healthyTimeout_&&(clearTimeout(this.healthyTimeout_),this.healthyTimeout_=null)}}/**
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
 */class Vi{put(e,t,i,s){}merge(e,t,i,s){}refreshAuthToken(e){}refreshAppCheckToken(e){}onDisconnectPut(e,t,i){}onDisconnectMerge(e,t,i){}onDisconnectCancel(e,t){}reportStats(e){}}/**
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
 */class Gi{constructor(e){this.allowedEvents_=e,this.listeners_={},f(Array.isArray(e)&&e.length>0,"Requires a non-empty array")}trigger(e,...t){if(Array.isArray(this.listeners_[e])){const i=[...this.listeners_[e]];for(let s=0;s<i.length;s++)i[s].callback.apply(i[s].context,t)}}on(e,t,i){this.validateEventType_(e),this.listeners_[e]=this.listeners_[e]||[],this.listeners_[e].push({callback:t,context:i});const s=this.getInitialEvent(e);s&&t.apply(i,s)}off(e,t,i){this.validateEventType_(e);const s=this.listeners_[e]||[];for(let r=0;r<s.length;r++)if(s[r].callback===t&&(!i||i===s[r].context)){s.splice(r,1);return}}validateEventType_(e){f(this.allowedEvents_.find(t=>t===e),"Unknown event: "+e)}}/**
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
 */class rt extends Gi{static getInstance(){return new rt}constructor(){super(["online"]),this.online_=!0,typeof window<"u"&&typeof window.addEventListener<"u"&&!mi()&&(window.addEventListener("online",()=>{this.online_||(this.online_=!0,this.trigger("online",!0))},!1),window.addEventListener("offline",()=>{this.online_&&(this.online_=!1,this.trigger("online",!1))},!1))}getInitialEvent(e){return f(e==="online","Unknown event type: "+e),[this.online_]}currentlyOnline(){return this.online_}}/**
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
 */const Yn=32,Kn=768;class E{constructor(e,t){if(t===void 0){this.pieces_=e.split("/");let i=0;for(let s=0;s<this.pieces_.length;s++)this.pieces_[s].length>0&&(this.pieces_[i]=this.pieces_[s],i++);this.pieces_.length=i,this.pieceNum_=0}else this.pieces_=e,this.pieceNum_=t}toString(){let e="";for(let t=this.pieceNum_;t<this.pieces_.length;t++)this.pieces_[t]!==""&&(e+="/"+this.pieces_[t]);return e||"/"}}function C(){return new E("")}function m(n){return n.pieceNum_>=n.pieces_.length?null:n.pieces_[n.pieceNum_]}function te(n){return n.pieces_.length-n.pieceNum_}function I(n){let e=n.pieceNum_;return e<n.pieces_.length&&e++,new E(n.pieces_,e)}function rn(n){return n.pieceNum_<n.pieces_.length?n.pieces_[n.pieces_.length-1]:null}function zr(n){let e="";for(let t=n.pieceNum_;t<n.pieces_.length;t++)n.pieces_[t]!==""&&(e+="/"+encodeURIComponent(String(n.pieces_[t])));return e||"/"}function Fe(n,e=0){return n.pieces_.slice(n.pieceNum_+e)}function Bi(n){if(n.pieceNum_>=n.pieces_.length)return null;const e=[];for(let t=n.pieceNum_;t<n.pieces_.length-1;t++)e.push(n.pieces_[t]);return new E(e,0)}function N(n,e){const t=[];for(let i=n.pieceNum_;i<n.pieces_.length;i++)t.push(n.pieces_[i]);if(e instanceof E)for(let i=e.pieceNum_;i<e.pieces_.length;i++)t.push(e.pieces_[i]);else{const i=e.split("/");for(let s=0;s<i.length;s++)i[s].length>0&&t.push(i[s])}return new E(t,0)}function y(n){return n.pieceNum_>=n.pieces_.length}function O(n,e){const t=m(n),i=m(e);if(t===null)return e;if(t===i)return O(I(n),I(e));throw new Error("INTERNAL ERROR: innerPath ("+e+") is not within outerPath ("+n+")")}function jr(n,e){const t=Fe(n,0),i=Fe(e,0);for(let s=0;s<t.length&&s<i.length;s++){const r=he(t[s],i[s]);if(r!==0)return r}return t.length===i.length?0:t.length<i.length?-1:1}function on(n,e){if(te(n)!==te(e))return!1;for(let t=n.pieceNum_,i=e.pieceNum_;t<=n.pieces_.length;t++,i++)if(n.pieces_[t]!==e.pieces_[i])return!1;return!0}function F(n,e){let t=n.pieceNum_,i=e.pieceNum_;if(te(n)>te(e))return!1;for(;t<n.pieces_.length;){if(n.pieces_[t]!==e.pieces_[i])return!1;++t,++i}return!0}class $r{constructor(e,t){this.errorPrefix_=t,this.parts_=Fe(e,0),this.byteLength_=Math.max(1,this.parts_.length);for(let i=0;i<this.parts_.length;i++)this.byteLength_+=yt(this.parts_[i]);Hi(this)}}function Xr(n,e){n.parts_.length>0&&(n.byteLength_+=1),n.parts_.push(e),n.byteLength_+=yt(e),Hi(n)}function Jr(n){const e=n.parts_.pop();n.byteLength_-=yt(e),n.parts_.length>0&&(n.byteLength_-=1)}function Hi(n){if(n.byteLength_>Kn)throw new Error(n.errorPrefix_+"has a key path longer than "+Kn+" bytes ("+n.byteLength_+").");if(n.parts_.length>Yn)throw new Error(n.errorPrefix_+"path specified exceeds the maximum depth that can be written ("+Yn+") or object contains a cycle "+re(n))}function re(n){return n.parts_.length===0?"":"in property '"+n.parts_.join(".")+"'"}/**
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
 */class ln extends Gi{static getInstance(){return new ln}constructor(){super(["visible"]);let e,t;typeof document<"u"&&typeof document.addEventListener<"u"&&(typeof document.hidden<"u"?(t="visibilitychange",e="hidden"):typeof document.mozHidden<"u"?(t="mozvisibilitychange",e="mozHidden"):typeof document.msHidden<"u"?(t="msvisibilitychange",e="msHidden"):typeof document.webkitHidden<"u"&&(t="webkitvisibilitychange",e="webkitHidden")),this.visible_=!0,t&&document.addEventListener(t,()=>{const i=!document[e];i!==this.visible_&&(this.visible_=i,this.trigger("visible",i))},!1)}getInitialEvent(e){return f(e==="visible","Unknown event type: "+e),[this.visible_]}}/**
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
 */const be=1e3,Zr=60*5*1e3,zn=30*1e3,eo=1.3,to=3e4,no="server_kill",jn=3;class Y extends Vi{constructor(e,t,i,s,r,o,l,a){if(super(),this.repoInfo_=e,this.applicationId_=t,this.onDataUpdate_=i,this.onConnectStatus_=s,this.onServerInfoUpdate_=r,this.authTokenProvider_=o,this.appCheckTokenProvider_=l,this.authOverride_=a,this.id=Y.nextPersistentConnectionId_++,this.log_=ze("p:"+this.id+":"),this.interruptReasons_={},this.listens=new Map,this.outstandingPuts_=[],this.outstandingGets_=[],this.outstandingPutCount_=0,this.outstandingGetCount_=0,this.onDisconnectRequestQueue_=[],this.connected_=!1,this.reconnectDelay_=be,this.maxReconnectDelay_=Zr,this.securityDebugCallback_=null,this.lastSessionId=null,this.establishConnectionTimer_=null,this.visible_=!1,this.requestCBHash_={},this.requestNumber_=0,this.realtime_=null,this.authToken_=null,this.appCheckToken_=null,this.forceTokenRefresh_=!1,this.invalidAuthTokenCount_=0,this.invalidAppCheckTokenCount_=0,this.firstConnection_=!0,this.lastConnectionAttemptTime_=null,this.lastConnectionEstablishedTime_=null,a)throw new Error("Auth override specified in options, but not supported on non Node.js platforms");ln.getInstance().on("visible",this.onVisible_,this),e.host.indexOf("fblocal")===-1&&rt.getInstance().on("online",this.onOnline_,this)}sendRequest(e,t,i){const s=++this.requestNumber_,r={r:s,a:e,b:t};this.log_(b(r)),f(this.connected_,"sendRequest call when we're not connected not allowed."),this.realtime_.sendRequest(r),i&&(this.requestCBHash_[s]=i)}get(e){this.initConnection_();const t=new q,s={action:"g",request:{p:e._path.toString(),q:e._queryObject},onComplete:o=>{const l=o.d;o.s==="ok"?t.resolve(l):t.reject(l)}};this.outstandingGets_.push(s),this.outstandingGetCount_++;const r=this.outstandingGets_.length-1;return this.connected_&&this.sendGet_(r),t.promise}listen(e,t,i,s){this.initConnection_();const r=e._queryIdentifier,o=e._path.toString();this.log_("Listen called for "+o+" "+r),this.listens.has(o)||this.listens.set(o,new Map),f(e._queryParams.isDefault()||!e._queryParams.loadsAllData(),"listen() called for non-default but complete query"),f(!this.listens.get(o).has(r),"listen() called twice for same path/queryId.");const l={onComplete:s,hashFn:t,query:e,tag:i};this.listens.get(o).set(r,l),this.connected_&&this.sendListen_(l)}sendGet_(e){const t=this.outstandingGets_[e];this.sendRequest("g",t.request,i=>{delete this.outstandingGets_[e],this.outstandingGetCount_--,this.outstandingGetCount_===0&&(this.outstandingGets_=[]),t.onComplete&&t.onComplete(i)})}sendListen_(e){const t=e.query,i=t._path.toString(),s=t._queryIdentifier;this.log_("Listen on "+i+" for "+s);const r={p:i},o="q";e.tag&&(r.q=t._queryObject,r.t=e.tag),r.h=e.hashFn(),this.sendRequest(o,r,l=>{const a=l.d,c=l.s;Y.warnOnListenWarnings_(a,t),(this.listens.get(i)&&this.listens.get(i).get(s))===e&&(this.log_("listen response",l),c!=="ok"&&this.removeListen_(i,s),e.onComplete&&e.onComplete(c,a))})}static warnOnListenWarnings_(e,t){if(e&&typeof e=="object"&&H(e,"w")){const i=ge(e,"w");if(Array.isArray(i)&&~i.indexOf("no_index")){const s='".indexOn": "'+t._queryParams.getIndex().toString()+'"',r=t._path.toString();M(`Using an unspecified index. Your data will be downloaded and filtered on the client. Consider adding ${s} at ${r} to your security rules for better performance.`)}}}refreshAuthToken(e){this.authToken_=e,this.log_("Auth token refreshed"),this.authToken_?this.tryAuth():this.connected_&&this.sendRequest("unauth",{},()=>{}),this.reduceReconnectDelayIfAdminCredential_(e)}reduceReconnectDelayIfAdminCredential_(e){(e&&e.length===40||Ys(e))&&(this.log_("Admin auth credential detected.  Reducing max reconnect time."),this.maxReconnectDelay_=zn)}refreshAppCheckToken(e){this.appCheckToken_=e,this.log_("App check token refreshed"),this.appCheckToken_?this.tryAppCheck():this.connected_&&this.sendRequest("unappeck",{},()=>{})}tryAuth(){if(this.connected_&&this.authToken_){const e=this.authToken_,t=Ks(e)?"auth":"gauth",i={cred:e};this.authOverride_===null?i.noauth=!0:typeof this.authOverride_=="object"&&(i.authvar=this.authOverride_),this.sendRequest(t,i,s=>{const r=s.s,o=s.d||"error";this.authToken_===e&&(r==="ok"?this.invalidAuthTokenCount_=0:this.onAuthRevoked_(r,o))})}}tryAppCheck(){this.connected_&&this.appCheckToken_&&this.sendRequest("appcheck",{token:this.appCheckToken_},e=>{const t=e.s,i=e.d||"error";t==="ok"?this.invalidAppCheckTokenCount_=0:this.onAppCheckRevoked_(t,i)})}unlisten(e,t){const i=e._path.toString(),s=e._queryIdentifier;this.log_("Unlisten called for "+i+" "+s),f(e._queryParams.isDefault()||!e._queryParams.loadsAllData(),"unlisten() called for non-default but complete query"),this.removeListen_(i,s)&&this.connected_&&this.sendUnlisten_(i,s,e._queryObject,t)}sendUnlisten_(e,t,i,s){this.log_("Unlisten on "+e+" for "+t);const r={p:e},o="n";s&&(r.q=i,r.t=s),this.sendRequest(o,r)}onDisconnectPut(e,t,i){this.initConnection_(),this.connected_?this.sendOnDisconnect_("o",e,t,i):this.onDisconnectRequestQueue_.push({pathString:e,action:"o",data:t,onComplete:i})}onDisconnectMerge(e,t,i){this.initConnection_(),this.connected_?this.sendOnDisconnect_("om",e,t,i):this.onDisconnectRequestQueue_.push({pathString:e,action:"om",data:t,onComplete:i})}onDisconnectCancel(e,t){this.initConnection_(),this.connected_?this.sendOnDisconnect_("oc",e,null,t):this.onDisconnectRequestQueue_.push({pathString:e,action:"oc",data:null,onComplete:t})}sendOnDisconnect_(e,t,i,s){const r={p:t,d:i};this.log_("onDisconnect "+e,r),this.sendRequest(e,r,o=>{s&&setTimeout(()=>{s(o.s,o.d)},Math.floor(0))})}put(e,t,i,s){this.putInternal("p",e,t,i,s)}merge(e,t,i,s){this.putInternal("m",e,t,i,s)}putInternal(e,t,i,s,r){this.initConnection_();const o={p:t,d:i};r!==void 0&&(o.h=r),this.outstandingPuts_.push({action:e,request:o,onComplete:s}),this.outstandingPutCount_++;const l=this.outstandingPuts_.length-1;this.connected_?this.sendPut_(l):this.log_("Buffering put: "+t)}sendPut_(e){const t=this.outstandingPuts_[e].action,i=this.outstandingPuts_[e].request,s=this.outstandingPuts_[e].onComplete;this.outstandingPuts_[e].queued=this.connected_,this.sendRequest(t,i,r=>{this.log_(t+" response",r),delete this.outstandingPuts_[e],this.outstandingPutCount_--,this.outstandingPutCount_===0&&(this.outstandingPuts_=[]),s&&s(r.s,r.d)})}reportStats(e){if(this.connected_){const t={c:e};this.log_("reportStats",t),this.sendRequest("s",t,i=>{if(i.s!=="ok"){const r=i.d;this.log_("reportStats","Error sending stats: "+r)}})}}onDataMessage_(e){if("r"in e){this.log_("from server: "+b(e));const t=e.r,i=this.requestCBHash_[t];i&&(delete this.requestCBHash_[t],i(e.b))}else{if("error"in e)throw"A server-side error has occurred: "+e.error;"a"in e&&this.onDataPush_(e.a,e.b)}}onDataPush_(e,t){this.log_("handleServerMessage",e,t),e==="d"?this.onDataUpdate_(t.p,t.d,!1,t.t):e==="m"?this.onDataUpdate_(t.p,t.d,!0,t.t):e==="c"?this.onListenRevoked_(t.p,t.q):e==="ac"?this.onAuthRevoked_(t.s,t.d):e==="apc"?this.onAppCheckRevoked_(t.s,t.d):e==="sd"?this.onSecurityDebugPacket_(t):Vt("Unrecognized action received from server: "+b(e)+`
Are you using the latest client?`)}onReady_(e,t){this.log_("connection ready"),this.connected_=!0,this.lastConnectionEstablishedTime_=new Date().getTime(),this.handleTimestamp_(e),this.lastSessionId=t,this.firstConnection_&&this.sendConnectStats_(),this.restoreState_(),this.firstConnection_=!1,this.onConnectStatus_(!0)}scheduleConnect_(e){f(!this.realtime_,"Scheduling a connect when we're already connected/ing?"),this.establishConnectionTimer_&&clearTimeout(this.establishConnectionTimer_),this.establishConnectionTimer_=setTimeout(()=>{this.establishConnectionTimer_=null,this.establishConnection_()},Math.floor(e))}initConnection_(){!this.realtime_&&this.firstConnection_&&this.scheduleConnect_(0)}onVisible_(e){e&&!this.visible_&&this.reconnectDelay_===this.maxReconnectDelay_&&(this.log_("Window became visible.  Reducing delay."),this.reconnectDelay_=be,this.realtime_||this.scheduleConnect_(0)),this.visible_=e}onOnline_(e){e?(this.log_("Browser went online."),this.reconnectDelay_=be,this.realtime_||this.scheduleConnect_(0)):(this.log_("Browser went offline.  Killing connection."),this.realtime_&&this.realtime_.close())}onRealtimeDisconnect_(){if(this.log_("data client disconnected"),this.connected_=!1,this.realtime_=null,this.cancelSentTransactions_(),this.requestCBHash_={},this.shouldReconnect_()){this.visible_?this.lastConnectionEstablishedTime_&&(new Date().getTime()-this.lastConnectionEstablishedTime_>to&&(this.reconnectDelay_=be),this.lastConnectionEstablishedTime_=null):(this.log_("Window isn't visible.  Delaying reconnect."),this.reconnectDelay_=this.maxReconnectDelay_,this.lastConnectionAttemptTime_=new Date().getTime());const e=Math.max(0,new Date().getTime()-this.lastConnectionAttemptTime_);let t=Math.max(0,this.reconnectDelay_-e);t=Math.random()*t,this.log_("Trying to reconnect in "+t+"ms"),this.scheduleConnect_(t),this.reconnectDelay_=Math.min(this.maxReconnectDelay_,this.reconnectDelay_*eo)}this.onConnectStatus_(!1)}async establishConnection_(){if(this.shouldReconnect_()){this.log_("Making a connection attempt"),this.lastConnectionAttemptTime_=new Date().getTime(),this.lastConnectionEstablishedTime_=null;const e=this.onDataMessage_.bind(this),t=this.onReady_.bind(this),i=this.onRealtimeDisconnect_.bind(this),s=this.id+":"+Y.nextConnectionId_++,r=this.lastSessionId;let o=!1,l=null;const a=function(){l?l.close():(o=!0,i())},c=function(u){f(l,"sendRequest call when we're not connected not allowed."),l.sendRequest(u)};this.realtime_={close:a,sendRequest:c};const h=this.forceTokenRefresh_;this.forceTokenRefresh_=!1;try{const[u,d]=await Promise.all([this.authTokenProvider_.getToken(h),this.appCheckTokenProvider_.getToken(h)]);o?x("getToken() completed but was canceled"):(x("getToken() completed. Creating connection."),this.authToken_=u&&u.accessToken,this.appCheckToken_=d&&d.token,l=new Kr(s,this.repoInfo_,this.applicationId_,this.appCheckToken_,this.authToken_,e,t,i,_=>{M(_+" ("+this.repoInfo_.toString()+")"),this.interrupt(no)},r))}catch(u){this.log_("Failed to get token: "+u),o||(this.repoInfo_.nodeAdmin&&M(u),a())}}}interrupt(e){x("Interrupting connection for reason: "+e),this.interruptReasons_[e]=!0,this.realtime_?this.realtime_.close():(this.establishConnectionTimer_&&(clearTimeout(this.establishConnectionTimer_),this.establishConnectionTimer_=null),this.connected_&&this.onRealtimeDisconnect_())}resume(e){x("Resuming connection for reason: "+e),delete this.interruptReasons_[e],Ut(this.interruptReasons_)&&(this.reconnectDelay_=be,this.realtime_||this.scheduleConnect_(0))}handleTimestamp_(e){const t=e-new Date().getTime();this.onServerInfoUpdate_({serverTimeOffset:t})}cancelSentTransactions_(){for(let e=0;e<this.outstandingPuts_.length;e++){const t=this.outstandingPuts_[e];t&&"h"in t.request&&t.queued&&(t.onComplete&&t.onComplete("disconnect"),delete this.outstandingPuts_[e],this.outstandingPutCount_--)}this.outstandingPutCount_===0&&(this.outstandingPuts_=[])}onListenRevoked_(e,t){let i;t?i=t.map(r=>en(r)).join("$"):i="default";const s=this.removeListen_(e,i);s&&s.onComplete&&s.onComplete("permission_denied")}removeListen_(e,t){const i=new E(e).toString();let s;if(this.listens.has(i)){const r=this.listens.get(i);s=r.get(t),r.delete(t),r.size===0&&this.listens.delete(i)}else s=void 0;return s}onAuthRevoked_(e,t){x("Auth token revoked: "+e+"/"+t),this.authToken_=null,this.forceTokenRefresh_=!0,this.realtime_.close(),(e==="invalid_token"||e==="permission_denied")&&(this.invalidAuthTokenCount_++,this.invalidAuthTokenCount_>=jn&&(this.reconnectDelay_=zn,this.authTokenProvider_.notifyForInvalidToken()))}onAppCheckRevoked_(e,t){x("App check token revoked: "+e+"/"+t),this.appCheckToken_=null,this.forceTokenRefresh_=!0,(e==="invalid_token"||e==="permission_denied")&&(this.invalidAppCheckTokenCount_++,this.invalidAppCheckTokenCount_>=jn&&this.appCheckTokenProvider_.notifyForInvalidToken())}onSecurityDebugPacket_(e){this.securityDebugCallback_?this.securityDebugCallback_(e):"msg"in e&&console.log("FIREBASE: "+e.msg.replace(`
`,`
FIREBASE: `))}restoreState_(){this.tryAuth(),this.tryAppCheck();for(const e of this.listens.values())for(const t of e.values())this.sendListen_(t);for(let e=0;e<this.outstandingPuts_.length;e++)this.outstandingPuts_[e]&&this.sendPut_(e);for(;this.onDisconnectRequestQueue_.length;){const e=this.onDisconnectRequestQueue_.shift();this.sendOnDisconnect_(e.action,e.pathString,e.data,e.onComplete)}for(let e=0;e<this.outstandingGets_.length;e++)this.outstandingGets_[e]&&this.sendGet_(e)}sendConnectStats_(){const e={};let t="js";e["sdk."+t+"."+vi.replace(/\./g,"-")]=1,mi()?e["framework.cordova"]=1:zs()&&(e["framework.reactnative"]=1),this.reportStats(e)}shouldReconnect_(){const e=rt.getInstance().currentlyOnline();return Ut(this.interruptReasons_)&&e}}Y.nextPersistentConnectionId_=0;Y.nextConnectionId_=0;/**
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
 */class v{constructor(e,t){this.name=e,this.node=t}static Wrap(e,t){return new v(e,t)}}/**
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
 */class Ct{getCompare(){return this.compare.bind(this)}indexedValueChanged(e,t){const i=new v(Z,e),s=new v(Z,t);return this.compare(i,s)!==0}minPost(){return v.MIN}}/**
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
 */let et;class qi extends Ct{static get __EMPTY_NODE(){return et}static set __EMPTY_NODE(e){et=e}compare(e,t){return he(e.name,t.name)}isDefinedOn(e){throw Ye("KeyIndex.isDefinedOn not expected to be called.")}indexedValueChanged(e,t){return!1}minPost(){return v.MIN}maxPost(){return new v(ee,et)}makePost(e,t){return f(typeof e=="string","KeyIndex indexValue must always be a string."),new v(e,et)}toString(){return".key"}}const K=new qi;/**
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
 */class tt{constructor(e,t,i,s,r=null){this.isReverse_=s,this.resultGenerator_=r,this.nodeStack_=[];let o=1;for(;!e.isEmpty();)if(e=e,o=t?i(e.key,t):1,s&&(o*=-1),o<0)this.isReverse_?e=e.left:e=e.right;else if(o===0){this.nodeStack_.push(e);break}else this.nodeStack_.push(e),this.isReverse_?e=e.right:e=e.left}getNext(){if(this.nodeStack_.length===0)return null;let e=this.nodeStack_.pop(),t;if(this.resultGenerator_?t=this.resultGenerator_(e.key,e.value):t={key:e.key,value:e.value},this.isReverse_)for(e=e.left;!e.isEmpty();)this.nodeStack_.push(e),e=e.right;else for(e=e.right;!e.isEmpty();)this.nodeStack_.push(e),e=e.left;return t}hasNext(){return this.nodeStack_.length>0}peek(){if(this.nodeStack_.length===0)return null;const e=this.nodeStack_[this.nodeStack_.length-1];return this.resultGenerator_?this.resultGenerator_(e.key,e.value):{key:e.key,value:e.value}}}class P{constructor(e,t,i,s,r){this.key=e,this.value=t,this.color=i??P.RED,this.left=s??L.EMPTY_NODE,this.right=r??L.EMPTY_NODE}copy(e,t,i,s,r){return new P(e??this.key,t??this.value,i??this.color,s??this.left,r??this.right)}count(){return this.left.count()+1+this.right.count()}isEmpty(){return!1}inorderTraversal(e){return this.left.inorderTraversal(e)||!!e(this.key,this.value)||this.right.inorderTraversal(e)}reverseTraversal(e){return this.right.reverseTraversal(e)||e(this.key,this.value)||this.left.reverseTraversal(e)}min_(){return this.left.isEmpty()?this:this.left.min_()}minKey(){return this.min_().key}maxKey(){return this.right.isEmpty()?this.key:this.right.maxKey()}insert(e,t,i){let s=this;const r=i(e,s.key);return r<0?s=s.copy(null,null,null,s.left.insert(e,t,i),null):r===0?s=s.copy(null,t,null,null,null):s=s.copy(null,null,null,null,s.right.insert(e,t,i)),s.fixUp_()}removeMin_(){if(this.left.isEmpty())return L.EMPTY_NODE;let e=this;return!e.left.isRed_()&&!e.left.left.isRed_()&&(e=e.moveRedLeft_()),e=e.copy(null,null,null,e.left.removeMin_(),null),e.fixUp_()}remove(e,t){let i,s;if(i=this,t(e,i.key)<0)!i.left.isEmpty()&&!i.left.isRed_()&&!i.left.left.isRed_()&&(i=i.moveRedLeft_()),i=i.copy(null,null,null,i.left.remove(e,t),null);else{if(i.left.isRed_()&&(i=i.rotateRight_()),!i.right.isEmpty()&&!i.right.isRed_()&&!i.right.left.isRed_()&&(i=i.moveRedRight_()),t(e,i.key)===0){if(i.right.isEmpty())return L.EMPTY_NODE;s=i.right.min_(),i=i.copy(s.key,s.value,null,null,i.right.removeMin_())}i=i.copy(null,null,null,null,i.right.remove(e,t))}return i.fixUp_()}isRed_(){return this.color}fixUp_(){let e=this;return e.right.isRed_()&&!e.left.isRed_()&&(e=e.rotateLeft_()),e.left.isRed_()&&e.left.left.isRed_()&&(e=e.rotateRight_()),e.left.isRed_()&&e.right.isRed_()&&(e=e.colorFlip_()),e}moveRedLeft_(){let e=this.colorFlip_();return e.right.left.isRed_()&&(e=e.copy(null,null,null,null,e.right.rotateRight_()),e=e.rotateLeft_(),e=e.colorFlip_()),e}moveRedRight_(){let e=this.colorFlip_();return e.left.left.isRed_()&&(e=e.rotateRight_(),e=e.colorFlip_()),e}rotateLeft_(){const e=this.copy(null,null,P.RED,null,this.right.left);return this.right.copy(null,null,this.color,e,null)}rotateRight_(){const e=this.copy(null,null,P.RED,this.left.right,null);return this.left.copy(null,null,this.color,null,e)}colorFlip_(){const e=this.left.copy(null,null,!this.left.color,null,null),t=this.right.copy(null,null,!this.right.color,null,null);return this.copy(null,null,!this.color,e,t)}checkMaxDepth_(){const e=this.check_();return Math.pow(2,e)<=this.count()+1}check_(){if(this.isRed_()&&this.left.isRed_())throw new Error("Red node has red child("+this.key+","+this.value+")");if(this.right.isRed_())throw new Error("Right child of ("+this.key+","+this.value+") is red");const e=this.left.check_();if(e!==this.right.check_())throw new Error("Black depths differ");return e+(this.isRed_()?0:1)}}P.RED=!0;P.BLACK=!1;class io{copy(e,t,i,s,r){return this}insert(e,t,i){return new P(e,t,null)}remove(e,t){return this}count(){return 0}isEmpty(){return!0}inorderTraversal(e){return!1}reverseTraversal(e){return!1}minKey(){return null}maxKey(){return null}check_(){return 0}isRed_(){return!1}}class L{constructor(e,t=L.EMPTY_NODE){this.comparator_=e,this.root_=t}insert(e,t){return new L(this.comparator_,this.root_.insert(e,t,this.comparator_).copy(null,null,P.BLACK,null,null))}remove(e){return new L(this.comparator_,this.root_.remove(e,this.comparator_).copy(null,null,P.BLACK,null,null))}get(e){let t,i=this.root_;for(;!i.isEmpty();){if(t=this.comparator_(e,i.key),t===0)return i.value;t<0?i=i.left:t>0&&(i=i.right)}return null}getPredecessorKey(e){let t,i=this.root_,s=null;for(;!i.isEmpty();)if(t=this.comparator_(e,i.key),t===0){if(i.left.isEmpty())return s?s.key:null;for(i=i.left;!i.right.isEmpty();)i=i.right;return i.key}else t<0?i=i.left:t>0&&(s=i,i=i.right);throw new Error("Attempted to find predecessor key for a nonexistent key.  What gives?")}isEmpty(){return this.root_.isEmpty()}count(){return this.root_.count()}minKey(){return this.root_.minKey()}maxKey(){return this.root_.maxKey()}inorderTraversal(e){return this.root_.inorderTraversal(e)}reverseTraversal(e){return this.root_.reverseTraversal(e)}getIterator(e){return new tt(this.root_,null,this.comparator_,!1,e)}getIteratorFrom(e,t){return new tt(this.root_,e,this.comparator_,!1,t)}getReverseIteratorFrom(e,t){return new tt(this.root_,e,this.comparator_,!0,t)}getReverseIterator(e){return new tt(this.root_,null,this.comparator_,!0,e)}}L.EMPTY_NODE=new io;/**
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
 */function so(n,e){return he(n.name,e.name)}function an(n,e){return he(n,e)}/**
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
 */let Bt;function ro(n){Bt=n}const Qi=function(n){return typeof n=="number"?"number:"+Ii(n):"string:"+n},Yi=function(n){if(n.isLeafNode()){const e=n.val();f(typeof e=="string"||typeof e=="number"||typeof e=="object"&&H(e,".sv"),"Priority must be a string or number.")}else f(n===Bt||n.isEmpty(),"priority of unexpected type.");f(n===Bt||n.getPriority().isEmpty(),"Priority nodes can't have a priority of their own.")};/**
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
 */let $n;class k{static set __childrenNodeConstructor(e){$n=e}static get __childrenNodeConstructor(){return $n}constructor(e,t=k.__childrenNodeConstructor.EMPTY_NODE){this.value_=e,this.priorityNode_=t,this.lazyHash_=null,f(this.value_!==void 0&&this.value_!==null,"LeafNode shouldn't be created with null/undefined value."),Yi(this.priorityNode_)}isLeafNode(){return!0}getPriority(){return this.priorityNode_}updatePriority(e){return new k(this.value_,e)}getImmediateChild(e){return e===".priority"?this.priorityNode_:k.__childrenNodeConstructor.EMPTY_NODE}getChild(e){return y(e)?this:m(e)===".priority"?this.priorityNode_:k.__childrenNodeConstructor.EMPTY_NODE}hasChild(){return!1}getPredecessorChildName(e,t){return null}updateImmediateChild(e,t){return e===".priority"?this.updatePriority(t):t.isEmpty()&&e!==".priority"?this:k.__childrenNodeConstructor.EMPTY_NODE.updateImmediateChild(e,t).updatePriority(this.priorityNode_)}updateChild(e,t){const i=m(e);return i===null?t:t.isEmpty()&&i!==".priority"?this:(f(i!==".priority"||te(e)===1,".priority must be the last token in a path"),this.updateImmediateChild(i,k.__childrenNodeConstructor.EMPTY_NODE.updateChild(I(e),t)))}isEmpty(){return!1}numChildren(){return 0}forEachChild(e,t){return!1}val(e){return e&&!this.getPriority().isEmpty()?{".value":this.getValue(),".priority":this.getPriority().val()}:this.getValue()}hash(){if(this.lazyHash_===null){let e="";this.priorityNode_.isEmpty()||(e+="priority:"+Qi(this.priorityNode_.val())+":");const t=typeof this.value_;e+=t+":",t==="number"?e+=Ii(this.value_):e+=this.value_,this.lazyHash_=Ei(e)}return this.lazyHash_}getValue(){return this.value_}compareTo(e){return e===k.__childrenNodeConstructor.EMPTY_NODE?1:e instanceof k.__childrenNodeConstructor?-1:(f(e.isLeafNode(),"Unknown node type"),this.compareToLeafNode_(e))}compareToLeafNode_(e){const t=typeof e.value_,i=typeof this.value_,s=k.VALUE_TYPE_ORDER.indexOf(t),r=k.VALUE_TYPE_ORDER.indexOf(i);return f(s>=0,"Unknown leaf type: "+t),f(r>=0,"Unknown leaf type: "+i),s===r?i==="object"?0:this.value_<e.value_?-1:this.value_===e.value_?0:1:r-s}withIndex(){return this}isIndexed(){return!0}equals(e){if(e===this)return!0;if(e.isLeafNode()){const t=e;return this.value_===t.value_&&this.priorityNode_.equals(t.priorityNode_)}else return!1}}k.VALUE_TYPE_ORDER=["object","boolean","number","string"];/**
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
 */let Ki,zi;function oo(n){Ki=n}function lo(n){zi=n}class ao extends Ct{compare(e,t){const i=e.node.getPriority(),s=t.node.getPriority(),r=i.compareTo(s);return r===0?he(e.name,t.name):r}isDefinedOn(e){return!e.getPriority().isEmpty()}indexedValueChanged(e,t){return!e.getPriority().equals(t.getPriority())}minPost(){return v.MIN}maxPost(){return new v(ee,new k("[PRIORITY-POST]",zi))}makePost(e,t){const i=Ki(e);return new v(t,new k("[PRIORITY-POST]",i))}toString(){return".priority"}}const S=new ao;/**
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
 */const co=Math.log(2);class ho{constructor(e){const t=r=>parseInt(Math.log(r)/co,10),i=r=>parseInt(Array(r+1).join("1"),2);this.count=t(e+1),this.current_=this.count-1;const s=i(this.count);this.bits_=e+1&s}nextBitIsOne(){const e=!(this.bits_&1<<this.current_);return this.current_--,e}}const ot=function(n,e,t,i){n.sort(e);const s=function(a,c){const h=c-a;let u,d;if(h===0)return null;if(h===1)return u=n[a],d=t?t(u):u,new P(d,u.node,P.BLACK,null,null);{const _=parseInt(h/2,10)+a,p=s(a,_),w=s(_+1,c);return u=n[_],d=t?t(u):u,new P(d,u.node,P.BLACK,p,w)}},r=function(a){let c=null,h=null,u=n.length;const d=function(p,w){const D=u-p,de=u;u-=p;const Ze=s(D+1,de),xt=n[D],Ls=t?t(xt):xt;_(new P(Ls,xt.node,w,null,Ze))},_=function(p){c?(c.left=p,c=p):(h=p,c=p)};for(let p=0;p<a.count;++p){const w=a.nextBitIsOne(),D=Math.pow(2,a.count-(p+1));w?d(D,P.BLACK):(d(D,P.BLACK),d(D,P.RED))}return h},o=new ho(n.length),l=r(o);return new L(i||e,l)};/**
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
 */let Mt;const fe={};class Q{static get Default(){return f(fe&&S,"ChildrenNode.ts has not been loaded"),Mt=Mt||new Q({".priority":fe},{".priority":S}),Mt}constructor(e,t){this.indexes_=e,this.indexSet_=t}get(e){const t=ge(this.indexes_,e);if(!t)throw new Error("No index defined for "+e);return t instanceof L?t:null}hasIndex(e){return H(this.indexSet_,e.toString())}addIndex(e,t){f(e!==K,"KeyIndex always exists and isn't meant to be added to the IndexMap.");const i=[];let s=!1;const r=t.getIterator(v.Wrap);let o=r.getNext();for(;o;)s=s||e.isDefinedOn(o.node),i.push(o),o=r.getNext();let l;s?l=ot(i,e.getCompare()):l=fe;const a=e.toString(),c={...this.indexSet_};c[a]=e;const h={...this.indexes_};return h[a]=l,new Q(h,c)}addToIndexes(e,t){const i=it(this.indexes_,(s,r)=>{const o=ge(this.indexSet_,r);if(f(o,"Missing index implementation for "+r),s===fe)if(o.isDefinedOn(e.node)){const l=[],a=t.getIterator(v.Wrap);let c=a.getNext();for(;c;)c.name!==e.name&&l.push(c),c=a.getNext();return l.push(e),ot(l,o.getCompare())}else return fe;else{const l=t.get(e.name);let a=s;return l&&(a=a.remove(new v(e.name,l))),a.insert(e,e.node)}});return new Q(i,this.indexSet_)}removeFromIndexes(e,t){const i=it(this.indexes_,s=>{if(s===fe)return s;{const r=t.get(e.name);return r?s.remove(new v(e.name,r)):s}});return new Q(i,this.indexSet_)}}/**
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
 */let ke;class g{static get EMPTY_NODE(){return ke||(ke=new g(new L(an),null,Q.Default))}constructor(e,t,i){this.children_=e,this.priorityNode_=t,this.indexMap_=i,this.lazyHash_=null,this.priorityNode_&&Yi(this.priorityNode_),this.children_.isEmpty()&&f(!this.priorityNode_||this.priorityNode_.isEmpty(),"An empty node cannot have a priority")}isLeafNode(){return!1}getPriority(){return this.priorityNode_||ke}updatePriority(e){return this.children_.isEmpty()?this:new g(this.children_,e,this.indexMap_)}getImmediateChild(e){if(e===".priority")return this.getPriority();{const t=this.children_.get(e);return t===null?ke:t}}getChild(e){const t=m(e);return t===null?this:this.getImmediateChild(t).getChild(I(e))}hasChild(e){return this.children_.get(e)!==null}updateImmediateChild(e,t){if(f(t,"We should always be passing snapshot nodes"),e===".priority")return this.updatePriority(t);{const i=new v(e,t);let s,r;t.isEmpty()?(s=this.children_.remove(e),r=this.indexMap_.removeFromIndexes(i,this.children_)):(s=this.children_.insert(e,t),r=this.indexMap_.addToIndexes(i,this.children_));const o=s.isEmpty()?ke:this.priorityNode_;return new g(s,o,r)}}updateChild(e,t){const i=m(e);if(i===null)return t;{f(m(e)!==".priority"||te(e)===1,".priority must be the last token in a path");const s=this.getImmediateChild(i).updateChild(I(e),t);return this.updateImmediateChild(i,s)}}isEmpty(){return this.children_.isEmpty()}numChildren(){return this.children_.count()}val(e){if(this.isEmpty())return null;const t={};let i=0,s=0,r=!0;if(this.forEachChild(S,(o,l)=>{t[o]=l.val(e),i++,r&&g.INTEGER_REGEXP_.test(o)?s=Math.max(s,Number(o)):r=!1}),!e&&r&&s<2*i){const o=[];for(const l in t)o[l]=t[l];return o}else return e&&!this.getPriority().isEmpty()&&(t[".priority"]=this.getPriority().val()),t}hash(){if(this.lazyHash_===null){let e="";this.getPriority().isEmpty()||(e+="priority:"+Qi(this.getPriority().val())+":"),this.forEachChild(S,(t,i)=>{const s=i.hash();s!==""&&(e+=":"+t+":"+s)}),this.lazyHash_=e===""?"":Ei(e)}return this.lazyHash_}getPredecessorChildName(e,t,i){const s=this.resolveIndex_(i);if(s){const r=s.getPredecessorKey(new v(e,t));return r?r.name:null}else return this.children_.getPredecessorKey(e)}getFirstChildName(e){const t=this.resolveIndex_(e);if(t){const i=t.minKey();return i&&i.name}else return this.children_.minKey()}getFirstChild(e){const t=this.getFirstChildName(e);return t?new v(t,this.children_.get(t)):null}getLastChildName(e){const t=this.resolveIndex_(e);if(t){const i=t.maxKey();return i&&i.name}else return this.children_.maxKey()}getLastChild(e){const t=this.getLastChildName(e);return t?new v(t,this.children_.get(t)):null}forEachChild(e,t){const i=this.resolveIndex_(e);return i?i.inorderTraversal(s=>t(s.name,s.node)):this.children_.inorderTraversal(t)}getIterator(e){return this.getIteratorFrom(e.minPost(),e)}getIteratorFrom(e,t){const i=this.resolveIndex_(t);if(i)return i.getIteratorFrom(e,s=>s);{const s=this.children_.getIteratorFrom(e.name,v.Wrap);let r=s.peek();for(;r!=null&&t.compare(r,e)<0;)s.getNext(),r=s.peek();return s}}getReverseIterator(e){return this.getReverseIteratorFrom(e.maxPost(),e)}getReverseIteratorFrom(e,t){const i=this.resolveIndex_(t);if(i)return i.getReverseIteratorFrom(e,s=>s);{const s=this.children_.getReverseIteratorFrom(e.name,v.Wrap);let r=s.peek();for(;r!=null&&t.compare(r,e)>0;)s.getNext(),r=s.peek();return s}}compareTo(e){return this.isEmpty()?e.isEmpty()?0:-1:e.isLeafNode()||e.isEmpty()?1:e===je?-1:0}withIndex(e){if(e===K||this.indexMap_.hasIndex(e))return this;{const t=this.indexMap_.addIndex(e,this.children_);return new g(this.children_,this.priorityNode_,t)}}isIndexed(e){return e===K||this.indexMap_.hasIndex(e)}equals(e){if(e===this)return!0;if(e.isLeafNode())return!1;{const t=e;if(this.getPriority().equals(t.getPriority()))if(this.children_.count()===t.children_.count()){const i=this.getIterator(S),s=t.getIterator(S);let r=i.getNext(),o=s.getNext();for(;r&&o;){if(r.name!==o.name||!r.node.equals(o.node))return!1;r=i.getNext(),o=s.getNext()}return r===null&&o===null}else return!1;else return!1}}resolveIndex_(e){return e===K?null:this.indexMap_.get(e.toString())}}g.INTEGER_REGEXP_=/^(0|[1-9]\d*)$/;class uo extends g{constructor(){super(new L(an),g.EMPTY_NODE,Q.Default)}compareTo(e){return e===this?0:1}equals(e){return e===this}getPriority(){return this}getImmediateChild(e){return g.EMPTY_NODE}isEmpty(){return!1}}const je=new uo;Object.defineProperties(v,{MIN:{value:new v(Z,g.EMPTY_NODE)},MAX:{value:new v(ee,je)}});qi.__EMPTY_NODE=g.EMPTY_NODE;k.__childrenNodeConstructor=g;ro(je);lo(je);/**
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
 */const fo=!0;function R(n,e=null){if(n===null)return g.EMPTY_NODE;if(typeof n=="object"&&".priority"in n&&(e=n[".priority"]),f(e===null||typeof e=="string"||typeof e=="number"||typeof e=="object"&&".sv"in e,"Invalid priority type found: "+typeof e),typeof n=="object"&&".value"in n&&n[".value"]!==null&&(n=n[".value"]),typeof n!="object"||".sv"in n){const t=n;return new k(t,R(e))}if(!(n instanceof Array)&&fo){const t=[];let i=!1;if(A(n,(o,l)=>{if(o.substring(0,1)!=="."){const a=R(l);a.isEmpty()||(i=i||!a.getPriority().isEmpty(),t.push(new v(o,a)))}}),t.length===0)return g.EMPTY_NODE;const r=ot(t,so,o=>o.name,an);if(i){const o=ot(t,S.getCompare());return new g(r,R(e),new Q({".priority":o},{".priority":S}))}else return new g(r,R(e),Q.Default)}else{let t=g.EMPTY_NODE;return A(n,(i,s)=>{if(H(n,i)&&i.substring(0,1)!=="."){const r=R(s);(r.isLeafNode()||!r.isEmpty())&&(t=t.updateImmediateChild(i,r))}}),t.updatePriority(R(e))}}oo(R);/**
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
 */class ji extends Ct{constructor(e){super(),this.indexPath_=e,f(!y(e)&&m(e)!==".priority","Can't create PathIndex with empty path or .priority key")}extractChild(e){return e.getChild(this.indexPath_)}isDefinedOn(e){return!e.getChild(this.indexPath_).isEmpty()}compare(e,t){const i=this.extractChild(e.node),s=this.extractChild(t.node),r=i.compareTo(s);return r===0?he(e.name,t.name):r}makePost(e,t){const i=R(e),s=g.EMPTY_NODE.updateChild(this.indexPath_,i);return new v(t,s)}maxPost(){const e=g.EMPTY_NODE.updateChild(this.indexPath_,je);return new v(ee,e)}toString(){return Fe(this.indexPath_,0).join("/")}}/**
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
 */class _o extends Ct{compare(e,t){const i=e.node.compareTo(t.node);return i===0?he(e.name,t.name):i}isDefinedOn(e){return!0}indexedValueChanged(e,t){return!e.equals(t)}minPost(){return v.MIN}maxPost(){return v.MAX}makePost(e,t){const i=R(e);return new v(t,i)}toString(){return".value"}}const $i=new _o;/**
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
 */function Xi(n){return{type:"value",snapshotNode:n}}function ye(n,e){return{type:"child_added",snapshotNode:e,childName:n}}function We(n,e){return{type:"child_removed",snapshotNode:e,childName:n}}function Ue(n,e,t){return{type:"child_changed",snapshotNode:e,childName:n,oldSnap:t}}function po(n,e){return{type:"child_moved",snapshotNode:e,childName:n}}/**
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
 */class cn{constructor(e){this.index_=e}updateChild(e,t,i,s,r,o){f(e.isIndexed(this.index_),"A node must be indexed if only a child is updated");const l=e.getImmediateChild(t);return l.getChild(s).equals(i.getChild(s))&&l.isEmpty()===i.isEmpty()||(o!=null&&(i.isEmpty()?e.hasChild(t)?o.trackChildChange(We(t,l)):f(e.isLeafNode(),"A child remove without an old child only makes sense on a leaf node"):l.isEmpty()?o.trackChildChange(ye(t,i)):o.trackChildChange(Ue(t,i,l))),e.isLeafNode()&&i.isEmpty())?e:e.updateImmediateChild(t,i).withIndex(this.index_)}updateFullNode(e,t,i){return i!=null&&(e.isLeafNode()||e.forEachChild(S,(s,r)=>{t.hasChild(s)||i.trackChildChange(We(s,r))}),t.isLeafNode()||t.forEachChild(S,(s,r)=>{if(e.hasChild(s)){const o=e.getImmediateChild(s);o.equals(r)||i.trackChildChange(Ue(s,r,o))}else i.trackChildChange(ye(s,r))})),t.withIndex(this.index_)}updatePriority(e,t){return e.isEmpty()?g.EMPTY_NODE:e.updatePriority(t)}filtersNodes(){return!1}getIndexedFilter(){return this}getIndex(){return this.index_}}/**
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
 */class Ve{constructor(e){this.indexedFilter_=new cn(e.getIndex()),this.index_=e.getIndex(),this.startPost_=Ve.getStartPost_(e),this.endPost_=Ve.getEndPost_(e),this.startIsInclusive_=!e.startAfterSet_,this.endIsInclusive_=!e.endBeforeSet_}getStartPost(){return this.startPost_}getEndPost(){return this.endPost_}matches(e){const t=this.startIsInclusive_?this.index_.compare(this.getStartPost(),e)<=0:this.index_.compare(this.getStartPost(),e)<0,i=this.endIsInclusive_?this.index_.compare(e,this.getEndPost())<=0:this.index_.compare(e,this.getEndPost())<0;return t&&i}updateChild(e,t,i,s,r,o){return this.matches(new v(t,i))||(i=g.EMPTY_NODE),this.indexedFilter_.updateChild(e,t,i,s,r,o)}updateFullNode(e,t,i){t.isLeafNode()&&(t=g.EMPTY_NODE);let s=t.withIndex(this.index_);s=s.updatePriority(g.EMPTY_NODE);const r=this;return t.forEachChild(S,(o,l)=>{r.matches(new v(o,l))||(s=s.updateImmediateChild(o,g.EMPTY_NODE))}),this.indexedFilter_.updateFullNode(e,s,i)}updatePriority(e,t){return e}filtersNodes(){return!0}getIndexedFilter(){return this.indexedFilter_}getIndex(){return this.index_}static getStartPost_(e){if(e.hasStart()){const t=e.getIndexStartName();return e.getIndex().makePost(e.getIndexStartValue(),t)}else return e.getIndex().minPost()}static getEndPost_(e){if(e.hasEnd()){const t=e.getIndexEndName();return e.getIndex().makePost(e.getIndexEndValue(),t)}else return e.getIndex().maxPost()}}/**
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
 */class go{constructor(e){this.withinDirectionalStart=t=>this.reverse_?this.withinEndPost(t):this.withinStartPost(t),this.withinDirectionalEnd=t=>this.reverse_?this.withinStartPost(t):this.withinEndPost(t),this.withinStartPost=t=>{const i=this.index_.compare(this.rangedFilter_.getStartPost(),t);return this.startIsInclusive_?i<=0:i<0},this.withinEndPost=t=>{const i=this.index_.compare(t,this.rangedFilter_.getEndPost());return this.endIsInclusive_?i<=0:i<0},this.rangedFilter_=new Ve(e),this.index_=e.getIndex(),this.limit_=e.getLimit(),this.reverse_=!e.isViewFromLeft(),this.startIsInclusive_=!e.startAfterSet_,this.endIsInclusive_=!e.endBeforeSet_}updateChild(e,t,i,s,r,o){return this.rangedFilter_.matches(new v(t,i))||(i=g.EMPTY_NODE),e.getImmediateChild(t).equals(i)?e:e.numChildren()<this.limit_?this.rangedFilter_.getIndexedFilter().updateChild(e,t,i,s,r,o):this.fullLimitUpdateChild_(e,t,i,r,o)}updateFullNode(e,t,i){let s;if(t.isLeafNode()||t.isEmpty())s=g.EMPTY_NODE.withIndex(this.index_);else if(this.limit_*2<t.numChildren()&&t.isIndexed(this.index_)){s=g.EMPTY_NODE.withIndex(this.index_);let r;this.reverse_?r=t.getReverseIteratorFrom(this.rangedFilter_.getEndPost(),this.index_):r=t.getIteratorFrom(this.rangedFilter_.getStartPost(),this.index_);let o=0;for(;r.hasNext()&&o<this.limit_;){const l=r.getNext();if(this.withinDirectionalStart(l))if(this.withinDirectionalEnd(l))s=s.updateImmediateChild(l.name,l.node),o++;else break;else continue}}else{s=t.withIndex(this.index_),s=s.updatePriority(g.EMPTY_NODE);let r;this.reverse_?r=s.getReverseIterator(this.index_):r=s.getIterator(this.index_);let o=0;for(;r.hasNext();){const l=r.getNext();o<this.limit_&&this.withinDirectionalStart(l)&&this.withinDirectionalEnd(l)?o++:s=s.updateImmediateChild(l.name,g.EMPTY_NODE)}}return this.rangedFilter_.getIndexedFilter().updateFullNode(e,s,i)}updatePriority(e,t){return e}filtersNodes(){return!0}getIndexedFilter(){return this.rangedFilter_.getIndexedFilter()}getIndex(){return this.index_}fullLimitUpdateChild_(e,t,i,s,r){let o;if(this.reverse_){const u=this.index_.getCompare();o=(d,_)=>u(_,d)}else o=this.index_.getCompare();const l=e;f(l.numChildren()===this.limit_,"");const a=new v(t,i),c=this.reverse_?l.getFirstChild(this.index_):l.getLastChild(this.index_),h=this.rangedFilter_.matches(a);if(l.hasChild(t)){const u=l.getImmediateChild(t);let d=s.getChildAfterChild(this.index_,c,this.reverse_);for(;d!=null&&(d.name===t||l.hasChild(d.name));)d=s.getChildAfterChild(this.index_,d,this.reverse_);const _=d==null?1:o(d,a);if(h&&!i.isEmpty()&&_>=0)return r!=null&&r.trackChildChange(Ue(t,i,u)),l.updateImmediateChild(t,i);{r!=null&&r.trackChildChange(We(t,u));const w=l.updateImmediateChild(t,g.EMPTY_NODE);return d!=null&&this.rangedFilter_.matches(d)?(r!=null&&r.trackChildChange(ye(d.name,d.node)),w.updateImmediateChild(d.name,d.node)):w}}else return i.isEmpty()?e:h&&o(c,a)>=0?(r!=null&&(r.trackChildChange(We(c.name,c.node)),r.trackChildChange(ye(t,i))),l.updateImmediateChild(t,i).updateImmediateChild(c.name,g.EMPTY_NODE)):e}}/**
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
 */class hn{constructor(){this.limitSet_=!1,this.startSet_=!1,this.startNameSet_=!1,this.startAfterSet_=!1,this.endSet_=!1,this.endNameSet_=!1,this.endBeforeSet_=!1,this.limit_=0,this.viewFrom_="",this.indexStartValue_=null,this.indexStartName_="",this.indexEndValue_=null,this.indexEndName_="",this.index_=S}hasStart(){return this.startSet_}isViewFromLeft(){return this.viewFrom_===""?this.startSet_:this.viewFrom_==="l"}getIndexStartValue(){return f(this.startSet_,"Only valid if start has been set"),this.indexStartValue_}getIndexStartName(){return f(this.startSet_,"Only valid if start has been set"),this.startNameSet_?this.indexStartName_:Z}hasEnd(){return this.endSet_}getIndexEndValue(){return f(this.endSet_,"Only valid if end has been set"),this.indexEndValue_}getIndexEndName(){return f(this.endSet_,"Only valid if end has been set"),this.endNameSet_?this.indexEndName_:ee}hasLimit(){return this.limitSet_}hasAnchoredLimit(){return this.limitSet_&&this.viewFrom_!==""}getLimit(){return f(this.limitSet_,"Only valid if limit has been set"),this.limit_}getIndex(){return this.index_}loadsAllData(){return!(this.startSet_||this.endSet_||this.limitSet_)}isDefault(){return this.loadsAllData()&&this.index_===S}copy(){const e=new hn;return e.limitSet_=this.limitSet_,e.limit_=this.limit_,e.startSet_=this.startSet_,e.startAfterSet_=this.startAfterSet_,e.indexStartValue_=this.indexStartValue_,e.startNameSet_=this.startNameSet_,e.indexStartName_=this.indexStartName_,e.endSet_=this.endSet_,e.endBeforeSet_=this.endBeforeSet_,e.indexEndValue_=this.indexEndValue_,e.endNameSet_=this.endNameSet_,e.indexEndName_=this.indexEndName_,e.index_=this.index_,e.viewFrom_=this.viewFrom_,e}}function mo(n){return n.loadsAllData()?new cn(n.getIndex()):n.hasLimit()?new go(n):new Ve(n)}function yo(n,e){const t=n.copy();return t.limitSet_=!0,t.limit_=e,t.viewFrom_="r",t}function Xn(n,e,t){const i=n.copy();return i.endSet_=!0,e===void 0&&(e=null),i.indexEndValue_=e,t!==void 0?(i.endNameSet_=!0,i.indexEndName_=t):(i.endNameSet_=!1,i.indexEndName_=""),i}function vo(n,e,t){let i;return n.index_===K||t?i=Xn(n,e,t):i=Xn(n,e,Z),i.endBeforeSet_=!0,i}function Co(n,e){const t=n.copy();return t.index_=e,t}function Jn(n){const e={};if(n.isDefault())return e;let t;if(n.index_===S?t="$priority":n.index_===$i?t="$value":n.index_===K?t="$key":(f(n.index_ instanceof ji,"Unrecognized index type!"),t=n.index_.toString()),e.orderBy=b(t),n.startSet_){const i=n.startAfterSet_?"startAfter":"startAt";e[i]=b(n.indexStartValue_),n.startNameSet_&&(e[i]+=","+b(n.indexStartName_))}if(n.endSet_){const i=n.endBeforeSet_?"endBefore":"endAt";e[i]=b(n.indexEndValue_),n.endNameSet_&&(e[i]+=","+b(n.indexEndName_))}return n.limitSet_&&(n.isViewFromLeft()?e.limitToFirst=n.limit_:e.limitToLast=n.limit_),e}function Zn(n){const e={};if(n.startSet_&&(e.sp=n.indexStartValue_,n.startNameSet_&&(e.sn=n.indexStartName_),e.sin=!n.startAfterSet_),n.endSet_&&(e.ep=n.indexEndValue_,n.endNameSet_&&(e.en=n.indexEndName_),e.ein=!n.endBeforeSet_),n.limitSet_){e.l=n.limit_;let t=n.viewFrom_;t===""&&(n.isViewFromLeft()?t="l":t="r"),e.vf=t}return n.index_!==S&&(e.i=n.index_.toString()),e}/**
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
 */class lt extends Vi{reportStats(e){throw new Error("Method not implemented.")}static getListenId_(e,t){return t!==void 0?"tag$"+t:(f(e._queryParams.isDefault(),"should have a tag if it's not a default query."),e._path.toString())}constructor(e,t,i,s){super(),this.repoInfo_=e,this.onDataUpdate_=t,this.authTokenProvider_=i,this.appCheckTokenProvider_=s,this.log_=ze("p:rest:"),this.listens_={}}listen(e,t,i,s){const r=e._path.toString();this.log_("Listen called for "+r+" "+e._queryIdentifier);const o=lt.getListenId_(e,i),l={};this.listens_[o]=l;const a=Jn(e._queryParams);this.restRequest_(r+".json",a,(c,h)=>{let u=h;if(c===404&&(u=null,c=null),c===null&&this.onDataUpdate_(r,u,!1,i),ge(this.listens_,o)===l){let d;c?c===401?d="permission_denied":d="rest_error:"+c:d="ok",s(d,null)}})}unlisten(e,t){const i=lt.getListenId_(e,t);delete this.listens_[i]}get(e){const t=Jn(e._queryParams),i=e._path.toString(),s=new q;return this.restRequest_(i+".json",t,(r,o)=>{let l=o;r===404&&(l=null,r=null),r===null?(this.onDataUpdate_(i,l,!1,null),s.resolve(l)):s.reject(new Error(l))}),s.promise}refreshAuthToken(e){}restRequest_(e,t={},i){return t.format="export",Promise.all([this.authTokenProvider_.getToken(!1),this.appCheckTokenProvider_.getToken(!1)]).then(([s,r])=>{s&&s.accessToken&&(t.auth=s.accessToken),r&&r.token&&(t.ac=r.token);const o=(this.repoInfo_.secure?"https://":"http://")+this.repoInfo_.host+e+"?ns="+this.repoInfo_.namespace+Qs(t);this.log_("Sending REST request for "+o);const l=new XMLHttpRequest;l.onreadystatechange=()=>{if(i&&l.readyState===4){this.log_("REST Response for "+o+" received. status:",l.status,"response:",l.responseText);let a=null;if(l.status>=200&&l.status<300){try{a=Zt(l.responseText)}catch{M("Failed to parse JSON response for "+o+": "+l.responseText)}i(null,a)}else l.status!==401&&l.status!==404&&M("Got unsuccessful REST response for "+o+" Status: "+l.status),i(l.status);i=null}},l.open("GET",o,!0),l.send()})}}/**
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
 */class Eo{constructor(){this.rootNode_=g.EMPTY_NODE}getNode(e){return this.rootNode_.getChild(e)}updateSnapshot(e,t){this.rootNode_=this.rootNode_.updateChild(e,t)}}/**
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
 */function at(){return{value:null,children:new Map}}function Ie(n,e,t){if(y(e))n.value=t,n.children.clear();else if(n.value!==null)n.value=n.value.updateChild(e,t);else{const i=m(e);n.children.has(i)||n.children.set(i,at());const s=n.children.get(i);e=I(e),Ie(s,e,t)}}function Ht(n,e){if(y(e))return n.value=null,n.children.clear(),!0;if(n.value!==null){if(n.value.isLeafNode())return!1;{const t=n.value;return n.value=null,t.forEachChild(S,(i,s)=>{Ie(n,new E(i),s)}),Ht(n,e)}}else if(n.children.size>0){const t=m(e);return e=I(e),n.children.has(t)&&Ht(n.children.get(t),e)&&n.children.delete(t),n.children.size===0}else return!0}function qt(n,e,t){n.value!==null?t(e,n.value):wo(n,(i,s)=>{const r=new E(e.toString()+"/"+i);qt(s,r,t)})}function wo(n,e){n.children.forEach((t,i)=>{e(i,t)})}/**
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
 */class Io{constructor(e){this.collection_=e,this.last_=null}get(){const e=this.collection_.get(),t={...e};return this.last_&&A(this.last_,(i,s)=>{t[i]=t[i]-s}),this.last_=e,t}}/**
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
 */const ei=10*1e3,To=30*1e3,So=5*60*1e3;class No{constructor(e,t){this.server_=t,this.statsToReport_={},this.statsListener_=new Io(e);const i=ei+(To-ei)*Math.random();Ae(this.reportStats_.bind(this),Math.floor(i))}reportStats_(){const e=this.statsListener_.get(),t={};let i=!1;A(e,(s,r)=>{r>0&&H(this.statsToReport_,s)&&(t[s]=r,i=!0)}),i&&this.server_.reportStats(t),Ae(this.reportStats_.bind(this),Math.floor(Math.random()*2*So))}}/**
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
 */var V;(function(n){n[n.OVERWRITE=0]="OVERWRITE",n[n.MERGE=1]="MERGE",n[n.ACK_USER_WRITE=2]="ACK_USER_WRITE",n[n.LISTEN_COMPLETE=3]="LISTEN_COMPLETE"})(V||(V={}));function un(){return{fromUser:!0,fromServer:!1,queryId:null,tagged:!1}}function dn(){return{fromUser:!1,fromServer:!0,queryId:null,tagged:!1}}function fn(n){return{fromUser:!1,fromServer:!0,queryId:n,tagged:!0}}/**
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
 */class ct{constructor(e,t,i){this.path=e,this.affectedTree=t,this.revert=i,this.type=V.ACK_USER_WRITE,this.source=un()}operationForChild(e){if(y(this.path)){if(this.affectedTree.value!=null)return f(this.affectedTree.children.isEmpty(),"affectedTree should not have overlapping affected paths."),this;{const t=this.affectedTree.subtree(new E(e));return new ct(C(),t,this.revert)}}else return f(m(this.path)===e,"operationForChild called for unrelated child."),new ct(I(this.path),this.affectedTree,this.revert)}}/**
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
 */class Ge{constructor(e,t){this.source=e,this.path=t,this.type=V.LISTEN_COMPLETE}operationForChild(e){return y(this.path)?new Ge(this.source,C()):new Ge(this.source,I(this.path))}}/**
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
 */class ae{constructor(e,t,i){this.source=e,this.path=t,this.snap=i,this.type=V.OVERWRITE}operationForChild(e){return y(this.path)?new ae(this.source,C(),this.snap.getImmediateChild(e)):new ae(this.source,I(this.path),this.snap)}}/**
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
 */class ve{constructor(e,t,i){this.source=e,this.path=t,this.children=i,this.type=V.MERGE}operationForChild(e){if(y(this.path)){const t=this.children.subtree(new E(e));return t.isEmpty()?null:t.value?new ae(this.source,C(),t.value):new ve(this.source,C(),t)}else return f(m(this.path)===e,"Can't get a merge for a child not on the path of the operation"),new ve(this.source,I(this.path),this.children)}toString(){return"Operation("+this.path+": "+this.source.toString()+" merge: "+this.children.toString()+")"}}/**
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
 */class ne{constructor(e,t,i){this.node_=e,this.fullyInitialized_=t,this.filtered_=i}isFullyInitialized(){return this.fullyInitialized_}isFiltered(){return this.filtered_}isCompleteForPath(e){if(y(e))return this.isFullyInitialized()&&!this.filtered_;const t=m(e);return this.isCompleteForChild(t)}isCompleteForChild(e){return this.isFullyInitialized()&&!this.filtered_||this.node_.hasChild(e)}getNode(){return this.node_}}/**
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
 */class Ro{constructor(e){this.query_=e,this.index_=this.query_._queryParams.getIndex()}}function bo(n,e,t,i){const s=[],r=[];return e.forEach(o=>{o.type==="child_changed"&&n.index_.indexedValueChanged(o.oldSnap,o.snapshotNode)&&r.push(po(o.childName,o.snapshotNode))}),Pe(n,s,"child_removed",e,i,t),Pe(n,s,"child_added",e,i,t),Pe(n,s,"child_moved",r,i,t),Pe(n,s,"child_changed",e,i,t),Pe(n,s,"value",e,i,t),s}function Pe(n,e,t,i,s,r){const o=i.filter(l=>l.type===t);o.sort((l,a)=>Po(n,l,a)),o.forEach(l=>{const a=ko(n,l,r);s.forEach(c=>{c.respondsTo(l.type)&&e.push(c.createEvent(a,n.query_))})})}function ko(n,e,t){return e.type==="value"||e.type==="child_removed"||(e.prevName=t.getPredecessorChildName(e.childName,e.snapshotNode,n.index_)),e}function Po(n,e,t){if(e.childName==null||t.childName==null)throw Ye("Should only compare child_ events.");const i=new v(e.childName,e.snapshotNode),s=new v(t.childName,t.snapshotNode);return n.index_.compare(i,s)}/**
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
 */function Et(n,e){return{eventCache:n,serverCache:e}}function De(n,e,t,i){return Et(new ne(e,t,i),n.serverCache)}function Ji(n,e,t,i){return Et(n.eventCache,new ne(e,t,i))}function ht(n){return n.eventCache.isFullyInitialized()?n.eventCache.getNode():null}function ce(n){return n.serverCache.isFullyInitialized()?n.serverCache.getNode():null}/**
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
 */let Lt;const xo=()=>(Lt||(Lt=new L(fr)),Lt);class T{static fromObject(e){let t=new T(null);return A(e,(i,s)=>{t=t.set(new E(i),s)}),t}constructor(e,t=xo()){this.value=e,this.children=t}isEmpty(){return this.value===null&&this.children.isEmpty()}findRootMostMatchingPathAndValue(e,t){if(this.value!=null&&t(this.value))return{path:C(),value:this.value};if(y(e))return null;{const i=m(e),s=this.children.get(i);if(s!==null){const r=s.findRootMostMatchingPathAndValue(I(e),t);return r!=null?{path:N(new E(i),r.path),value:r.value}:null}else return null}}findRootMostValueAndPath(e){return this.findRootMostMatchingPathAndValue(e,()=>!0)}subtree(e){if(y(e))return this;{const t=m(e),i=this.children.get(t);return i!==null?i.subtree(I(e)):new T(null)}}set(e,t){if(y(e))return new T(t,this.children);{const i=m(e),r=(this.children.get(i)||new T(null)).set(I(e),t),o=this.children.insert(i,r);return new T(this.value,o)}}remove(e){if(y(e))return this.children.isEmpty()?new T(null):new T(null,this.children);{const t=m(e),i=this.children.get(t);if(i){const s=i.remove(I(e));let r;return s.isEmpty()?r=this.children.remove(t):r=this.children.insert(t,s),this.value===null&&r.isEmpty()?new T(null):new T(this.value,r)}else return this}}get(e){if(y(e))return this.value;{const t=m(e),i=this.children.get(t);return i?i.get(I(e)):null}}setTree(e,t){if(y(e))return t;{const i=m(e),r=(this.children.get(i)||new T(null)).setTree(I(e),t);let o;return r.isEmpty()?o=this.children.remove(i):o=this.children.insert(i,r),new T(this.value,o)}}fold(e){return this.fold_(C(),e)}fold_(e,t){const i={};return this.children.inorderTraversal((s,r)=>{i[s]=r.fold_(N(e,s),t)}),t(e,this.value,i)}findOnPath(e,t){return this.findOnPath_(e,C(),t)}findOnPath_(e,t,i){const s=this.value?i(t,this.value):!1;if(s)return s;if(y(e))return null;{const r=m(e),o=this.children.get(r);return o?o.findOnPath_(I(e),N(t,r),i):null}}foreachOnPath(e,t){return this.foreachOnPath_(e,C(),t)}foreachOnPath_(e,t,i){if(y(e))return this;{this.value&&i(t,this.value);const s=m(e),r=this.children.get(s);return r?r.foreachOnPath_(I(e),N(t,s),i):new T(null)}}foreach(e){this.foreach_(C(),e)}foreach_(e,t){this.children.inorderTraversal((i,s)=>{s.foreach_(N(e,i),t)}),this.value&&t(e,this.value)}foreachChild(e){this.children.inorderTraversal((t,i)=>{i.value&&e(t,i.value)})}}/**
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
 */class G{constructor(e){this.writeTree_=e}static empty(){return new G(new T(null))}}function Oe(n,e,t){if(y(e))return new G(new T(t));{const i=n.writeTree_.findRootMostValueAndPath(e);if(i!=null){const s=i.path;let r=i.value;const o=O(s,e);return r=r.updateChild(o,t),new G(n.writeTree_.set(s,r))}else{const s=new T(t),r=n.writeTree_.setTree(e,s);return new G(r)}}}function Qt(n,e,t){let i=n;return A(t,(s,r)=>{i=Oe(i,N(e,s),r)}),i}function ti(n,e){if(y(e))return G.empty();{const t=n.writeTree_.setTree(e,new T(null));return new G(t)}}function Yt(n,e){return ue(n,e)!=null}function ue(n,e){const t=n.writeTree_.findRootMostValueAndPath(e);return t!=null?n.writeTree_.get(t.path).getChild(O(t.path,e)):null}function ni(n){const e=[],t=n.writeTree_.value;return t!=null?t.isLeafNode()||t.forEachChild(S,(i,s)=>{e.push(new v(i,s))}):n.writeTree_.children.inorderTraversal((i,s)=>{s.value!=null&&e.push(new v(i,s.value))}),e}function X(n,e){if(y(e))return n;{const t=ue(n,e);return t!=null?new G(new T(t)):new G(n.writeTree_.subtree(e))}}function Kt(n){return n.writeTree_.isEmpty()}function Ce(n,e){return Zi(C(),n.writeTree_,e)}function Zi(n,e,t){if(e.value!=null)return t.updateChild(n,e.value);{let i=null;return e.children.inorderTraversal((s,r)=>{s===".priority"?(f(r.value!==null,"Priority writes must always be leaf nodes"),i=r.value):t=Zi(N(n,s),r,t)}),!t.getChild(n).isEmpty()&&i!==null&&(t=t.updateChild(N(n,".priority"),i)),t}}/**
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
 */function wt(n,e){return is(e,n)}function Ao(n,e,t,i,s){f(i>n.lastWriteId,"Stacking an older write on top of newer ones"),s===void 0&&(s=!0),n.allWrites.push({path:e,snap:t,writeId:i,visible:s}),s&&(n.visibleWrites=Oe(n.visibleWrites,e,t)),n.lastWriteId=i}function Do(n,e,t,i){f(i>n.lastWriteId,"Stacking an older merge on top of newer ones"),n.allWrites.push({path:e,children:t,writeId:i,visible:!0}),n.visibleWrites=Qt(n.visibleWrites,e,t),n.lastWriteId=i}function Oo(n,e){for(let t=0;t<n.allWrites.length;t++){const i=n.allWrites[t];if(i.writeId===e)return i}return null}function Mo(n,e){const t=n.allWrites.findIndex(l=>l.writeId===e);f(t>=0,"removeWrite called with nonexistent writeId.");const i=n.allWrites[t];n.allWrites.splice(t,1);let s=i.visible,r=!1,o=n.allWrites.length-1;for(;s&&o>=0;){const l=n.allWrites[o];l.visible&&(o>=t&&Lo(l,i.path)?s=!1:F(i.path,l.path)&&(r=!0)),o--}if(s){if(r)return Fo(n),!0;if(i.snap)n.visibleWrites=ti(n.visibleWrites,i.path);else{const l=i.children;A(l,a=>{n.visibleWrites=ti(n.visibleWrites,N(i.path,a))})}return!0}else return!1}function Lo(n,e){if(n.snap)return F(n.path,e);for(const t in n.children)if(n.children.hasOwnProperty(t)&&F(N(n.path,t),e))return!0;return!1}function Fo(n){n.visibleWrites=es(n.allWrites,Wo,C()),n.allWrites.length>0?n.lastWriteId=n.allWrites[n.allWrites.length-1].writeId:n.lastWriteId=-1}function Wo(n){return n.visible}function es(n,e,t){let i=G.empty();for(let s=0;s<n.length;++s){const r=n[s];if(e(r)){const o=r.path;let l;if(r.snap)F(t,o)?(l=O(t,o),i=Oe(i,l,r.snap)):F(o,t)&&(l=O(o,t),i=Oe(i,C(),r.snap.getChild(l)));else if(r.children){if(F(t,o))l=O(t,o),i=Qt(i,l,r.children);else if(F(o,t))if(l=O(o,t),y(l))i=Qt(i,C(),r.children);else{const a=ge(r.children,m(l));if(a){const c=a.getChild(I(l));i=Oe(i,C(),c)}}}else throw Ye("WriteRecord should have .snap or .children")}}return i}function ts(n,e,t,i,s){if(!i&&!s){const r=ue(n.visibleWrites,e);if(r!=null)return r;{const o=X(n.visibleWrites,e);if(Kt(o))return t;if(t==null&&!Yt(o,C()))return null;{const l=t||g.EMPTY_NODE;return Ce(o,l)}}}else{const r=X(n.visibleWrites,e);if(!s&&Kt(r))return t;if(!s&&t==null&&!Yt(r,C()))return null;{const o=function(c){return(c.visible||s)&&(!i||!~i.indexOf(c.writeId))&&(F(c.path,e)||F(e,c.path))},l=es(n.allWrites,o,e),a=t||g.EMPTY_NODE;return Ce(l,a)}}}function Uo(n,e,t){let i=g.EMPTY_NODE;const s=ue(n.visibleWrites,e);if(s)return s.isLeafNode()||s.forEachChild(S,(r,o)=>{i=i.updateImmediateChild(r,o)}),i;if(t){const r=X(n.visibleWrites,e);return t.forEachChild(S,(o,l)=>{const a=Ce(X(r,new E(o)),l);i=i.updateImmediateChild(o,a)}),ni(r).forEach(o=>{i=i.updateImmediateChild(o.name,o.node)}),i}else{const r=X(n.visibleWrites,e);return ni(r).forEach(o=>{i=i.updateImmediateChild(o.name,o.node)}),i}}function Vo(n,e,t,i,s){f(i||s,"Either existingEventSnap or existingServerSnap must exist");const r=N(e,t);if(Yt(n.visibleWrites,r))return null;{const o=X(n.visibleWrites,r);return Kt(o)?s.getChild(t):Ce(o,s.getChild(t))}}function Go(n,e,t,i){const s=N(e,t),r=ue(n.visibleWrites,s);if(r!=null)return r;if(i.isCompleteForChild(t)){const o=X(n.visibleWrites,s);return Ce(o,i.getNode().getImmediateChild(t))}else return null}function Bo(n,e){return ue(n.visibleWrites,e)}function Ho(n,e,t,i,s,r,o){let l;const a=X(n.visibleWrites,e),c=ue(a,C());if(c!=null)l=c;else if(t!=null)l=Ce(a,t);else return[];if(l=l.withIndex(o),!l.isEmpty()&&!l.isLeafNode()){const h=[],u=o.getCompare(),d=r?l.getReverseIteratorFrom(i,o):l.getIteratorFrom(i,o);let _=d.getNext();for(;_&&h.length<s;)u(_,i)!==0&&h.push(_),_=d.getNext();return h}else return[]}function qo(){return{visibleWrites:G.empty(),allWrites:[],lastWriteId:-1}}function ut(n,e,t,i){return ts(n.writeTree,n.treePath,e,t,i)}function _n(n,e){return Uo(n.writeTree,n.treePath,e)}function ii(n,e,t,i){return Vo(n.writeTree,n.treePath,e,t,i)}function dt(n,e){return Bo(n.writeTree,N(n.treePath,e))}function Qo(n,e,t,i,s,r){return Ho(n.writeTree,n.treePath,e,t,i,s,r)}function pn(n,e,t){return Go(n.writeTree,n.treePath,e,t)}function ns(n,e){return is(N(n.treePath,e),n.writeTree)}function is(n,e){return{treePath:n,writeTree:e}}/**
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
 */class Yo{constructor(){this.changeMap=new Map}trackChildChange(e){const t=e.type,i=e.childName;f(t==="child_added"||t==="child_changed"||t==="child_removed","Only child changes supported for tracking"),f(i!==".priority","Only non-priority child changes can be tracked.");const s=this.changeMap.get(i);if(s){const r=s.type;if(t==="child_added"&&r==="child_removed")this.changeMap.set(i,Ue(i,e.snapshotNode,s.snapshotNode));else if(t==="child_removed"&&r==="child_added")this.changeMap.delete(i);else if(t==="child_removed"&&r==="child_changed")this.changeMap.set(i,We(i,s.oldSnap));else if(t==="child_changed"&&r==="child_added")this.changeMap.set(i,ye(i,e.snapshotNode));else if(t==="child_changed"&&r==="child_changed")this.changeMap.set(i,Ue(i,e.snapshotNode,s.oldSnap));else throw Ye("Illegal combination of changes: "+e+" occurred after "+s)}else this.changeMap.set(i,e)}getChanges(){return Array.from(this.changeMap.values())}}/**
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
 */class Ko{getCompleteChild(e){return null}getChildAfterChild(e,t,i){return null}}const ss=new Ko;class gn{constructor(e,t,i=null){this.writes_=e,this.viewCache_=t,this.optCompleteServerCache_=i}getCompleteChild(e){const t=this.viewCache_.eventCache;if(t.isCompleteForChild(e))return t.getNode().getImmediateChild(e);{const i=this.optCompleteServerCache_!=null?new ne(this.optCompleteServerCache_,!0,!1):this.viewCache_.serverCache;return pn(this.writes_,e,i)}}getChildAfterChild(e,t,i){const s=this.optCompleteServerCache_!=null?this.optCompleteServerCache_:ce(this.viewCache_),r=Qo(this.writes_,s,t,1,i,e);return r.length===0?null:r[0]}}/**
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
 */function zo(n){return{filter:n}}function jo(n,e){f(e.eventCache.getNode().isIndexed(n.filter.getIndex()),"Event snap not indexed"),f(e.serverCache.getNode().isIndexed(n.filter.getIndex()),"Server snap not indexed")}function $o(n,e,t,i,s){const r=new Yo;let o,l;if(t.type===V.OVERWRITE){const c=t;c.source.fromUser?o=zt(n,e,c.path,c.snap,i,s,r):(f(c.source.fromServer,"Unknown source."),l=c.source.tagged||e.serverCache.isFiltered()&&!y(c.path),o=ft(n,e,c.path,c.snap,i,s,l,r))}else if(t.type===V.MERGE){const c=t;c.source.fromUser?o=Jo(n,e,c.path,c.children,i,s,r):(f(c.source.fromServer,"Unknown source."),l=c.source.tagged||e.serverCache.isFiltered(),o=jt(n,e,c.path,c.children,i,s,l,r))}else if(t.type===V.ACK_USER_WRITE){const c=t;c.revert?o=tl(n,e,c.path,i,s,r):o=Zo(n,e,c.path,c.affectedTree,i,s,r)}else if(t.type===V.LISTEN_COMPLETE)o=el(n,e,t.path,i,r);else throw Ye("Unknown operation type: "+t.type);const a=r.getChanges();return Xo(e,o,a),{viewCache:o,changes:a}}function Xo(n,e,t){const i=e.eventCache;if(i.isFullyInitialized()){const s=i.getNode().isLeafNode()||i.getNode().isEmpty(),r=ht(n);(t.length>0||!n.eventCache.isFullyInitialized()||s&&!i.getNode().equals(r)||!i.getNode().getPriority().equals(r.getPriority()))&&t.push(Xi(ht(e)))}}function rs(n,e,t,i,s,r){const o=e.eventCache;if(dt(i,t)!=null)return e;{let l,a;if(y(t))if(f(e.serverCache.isFullyInitialized(),"If change path is empty, we must have complete server data"),e.serverCache.isFiltered()){const c=ce(e),h=c instanceof g?c:g.EMPTY_NODE,u=_n(i,h);l=n.filter.updateFullNode(e.eventCache.getNode(),u,r)}else{const c=ut(i,ce(e));l=n.filter.updateFullNode(e.eventCache.getNode(),c,r)}else{const c=m(t);if(c===".priority"){f(te(t)===1,"Can't have a priority with additional path components");const h=o.getNode();a=e.serverCache.getNode();const u=ii(i,t,h,a);u!=null?l=n.filter.updatePriority(h,u):l=o.getNode()}else{const h=I(t);let u;if(o.isCompleteForChild(c)){a=e.serverCache.getNode();const d=ii(i,t,o.getNode(),a);d!=null?u=o.getNode().getImmediateChild(c).updateChild(h,d):u=o.getNode().getImmediateChild(c)}else u=pn(i,c,e.serverCache);u!=null?l=n.filter.updateChild(o.getNode(),c,u,h,s,r):l=o.getNode()}}return De(e,l,o.isFullyInitialized()||y(t),n.filter.filtersNodes())}}function ft(n,e,t,i,s,r,o,l){const a=e.serverCache;let c;const h=o?n.filter:n.filter.getIndexedFilter();if(y(t))c=h.updateFullNode(a.getNode(),i,null);else if(h.filtersNodes()&&!a.isFiltered()){const _=a.getNode().updateChild(t,i);c=h.updateFullNode(a.getNode(),_,null)}else{const _=m(t);if(!a.isCompleteForPath(t)&&te(t)>1)return e;const p=I(t),D=a.getNode().getImmediateChild(_).updateChild(p,i);_===".priority"?c=h.updatePriority(a.getNode(),D):c=h.updateChild(a.getNode(),_,D,p,ss,null)}const u=Ji(e,c,a.isFullyInitialized()||y(t),h.filtersNodes()),d=new gn(s,u,r);return rs(n,u,t,s,d,l)}function zt(n,e,t,i,s,r,o){const l=e.eventCache;let a,c;const h=new gn(s,e,r);if(y(t))c=n.filter.updateFullNode(e.eventCache.getNode(),i,o),a=De(e,c,!0,n.filter.filtersNodes());else{const u=m(t);if(u===".priority")c=n.filter.updatePriority(e.eventCache.getNode(),i),a=De(e,c,l.isFullyInitialized(),l.isFiltered());else{const d=I(t),_=l.getNode().getImmediateChild(u);let p;if(y(d))p=i;else{const w=h.getCompleteChild(u);w!=null?rn(d)===".priority"&&w.getChild(Bi(d)).isEmpty()?p=w:p=w.updateChild(d,i):p=g.EMPTY_NODE}if(_.equals(p))a=e;else{const w=n.filter.updateChild(l.getNode(),u,p,d,h,o);a=De(e,w,l.isFullyInitialized(),n.filter.filtersNodes())}}}return a}function si(n,e){return n.eventCache.isCompleteForChild(e)}function Jo(n,e,t,i,s,r,o){let l=e;return i.foreach((a,c)=>{const h=N(t,a);si(e,m(h))&&(l=zt(n,l,h,c,s,r,o))}),i.foreach((a,c)=>{const h=N(t,a);si(e,m(h))||(l=zt(n,l,h,c,s,r,o))}),l}function ri(n,e,t){return t.foreach((i,s)=>{e=e.updateChild(i,s)}),e}function jt(n,e,t,i,s,r,o,l){if(e.serverCache.getNode().isEmpty()&&!e.serverCache.isFullyInitialized())return e;let a=e,c;y(t)?c=i:c=new T(null).setTree(t,i);const h=e.serverCache.getNode();return c.children.inorderTraversal((u,d)=>{if(h.hasChild(u)){const _=e.serverCache.getNode().getImmediateChild(u),p=ri(n,_,d);a=ft(n,a,new E(u),p,s,r,o,l)}}),c.children.inorderTraversal((u,d)=>{const _=!e.serverCache.isCompleteForChild(u)&&d.value===null;if(!h.hasChild(u)&&!_){const p=e.serverCache.getNode().getImmediateChild(u),w=ri(n,p,d);a=ft(n,a,new E(u),w,s,r,o,l)}}),a}function Zo(n,e,t,i,s,r,o){if(dt(s,t)!=null)return e;const l=e.serverCache.isFiltered(),a=e.serverCache;if(i.value!=null){if(y(t)&&a.isFullyInitialized()||a.isCompleteForPath(t))return ft(n,e,t,a.getNode().getChild(t),s,r,l,o);if(y(t)){let c=new T(null);return a.getNode().forEachChild(K,(h,u)=>{c=c.set(new E(h),u)}),jt(n,e,t,c,s,r,l,o)}else return e}else{let c=new T(null);return i.foreach((h,u)=>{const d=N(t,h);a.isCompleteForPath(d)&&(c=c.set(h,a.getNode().getChild(d)))}),jt(n,e,t,c,s,r,l,o)}}function el(n,e,t,i,s){const r=e.serverCache,o=Ji(e,r.getNode(),r.isFullyInitialized()||y(t),r.isFiltered());return rs(n,o,t,i,ss,s)}function tl(n,e,t,i,s,r){let o;if(dt(i,t)!=null)return e;{const l=new gn(i,e,s),a=e.eventCache.getNode();let c;if(y(t)||m(t)===".priority"){let h;if(e.serverCache.isFullyInitialized())h=ut(i,ce(e));else{const u=e.serverCache.getNode();f(u instanceof g,"serverChildren would be complete if leaf node"),h=_n(i,u)}h=h,c=n.filter.updateFullNode(a,h,r)}else{const h=m(t);let u=pn(i,h,e.serverCache);u==null&&e.serverCache.isCompleteForChild(h)&&(u=a.getImmediateChild(h)),u!=null?c=n.filter.updateChild(a,h,u,I(t),l,r):e.eventCache.getNode().hasChild(h)?c=n.filter.updateChild(a,h,g.EMPTY_NODE,I(t),l,r):c=a,c.isEmpty()&&e.serverCache.isFullyInitialized()&&(o=ut(i,ce(e)),o.isLeafNode()&&(c=n.filter.updateFullNode(c,o,r)))}return o=e.serverCache.isFullyInitialized()||dt(i,C())!=null,De(e,c,o,n.filter.filtersNodes())}}/**
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
 */class nl{constructor(e,t){this.query_=e,this.eventRegistrations_=[];const i=this.query_._queryParams,s=new cn(i.getIndex()),r=mo(i);this.processor_=zo(r);const o=t.serverCache,l=t.eventCache,a=s.updateFullNode(g.EMPTY_NODE,o.getNode(),null),c=r.updateFullNode(g.EMPTY_NODE,l.getNode(),null),h=new ne(a,o.isFullyInitialized(),s.filtersNodes()),u=new ne(c,l.isFullyInitialized(),r.filtersNodes());this.viewCache_=Et(u,h),this.eventGenerator_=new Ro(this.query_)}get query(){return this.query_}}function il(n){return n.viewCache_.serverCache.getNode()}function sl(n){return ht(n.viewCache_)}function rl(n,e){const t=ce(n.viewCache_);return t&&(n.query._queryParams.loadsAllData()||!y(e)&&!t.getImmediateChild(m(e)).isEmpty())?t.getChild(e):null}function oi(n){return n.eventRegistrations_.length===0}function ol(n,e){n.eventRegistrations_.push(e)}function li(n,e,t){const i=[];if(t){f(e==null,"A cancel should cancel all event registrations.");const s=n.query._path;n.eventRegistrations_.forEach(r=>{const o=r.createCancelEvent(t,s);o&&i.push(o)})}if(e){let s=[];for(let r=0;r<n.eventRegistrations_.length;++r){const o=n.eventRegistrations_[r];if(!o.matches(e))s.push(o);else if(e.hasAnyCallback()){s=s.concat(n.eventRegistrations_.slice(r+1));break}}n.eventRegistrations_=s}else n.eventRegistrations_=[];return i}function ai(n,e,t,i){e.type===V.MERGE&&e.source.queryId!==null&&(f(ce(n.viewCache_),"We should always have a full cache before handling merges"),f(ht(n.viewCache_),"Missing event cache, even though we have a server cache"));const s=n.viewCache_,r=$o(n.processor_,s,e,t,i);return jo(n.processor_,r.viewCache),f(r.viewCache.serverCache.isFullyInitialized()||!s.serverCache.isFullyInitialized(),"Once a server snap is complete, it should never go back"),n.viewCache_=r.viewCache,os(n,r.changes,r.viewCache.eventCache.getNode(),null)}function ll(n,e){const t=n.viewCache_.eventCache,i=[];return t.getNode().isLeafNode()||t.getNode().forEachChild(S,(r,o)=>{i.push(ye(r,o))}),t.isFullyInitialized()&&i.push(Xi(t.getNode())),os(n,i,t.getNode(),e)}function os(n,e,t,i){const s=i?[i]:n.eventRegistrations_;return bo(n.eventGenerator_,e,t,s)}/**
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
 */let _t;class ls{constructor(){this.views=new Map}}function al(n){f(!_t,"__referenceConstructor has already been defined"),_t=n}function cl(){return f(_t,"Reference.ts has not been loaded"),_t}function hl(n){return n.views.size===0}function mn(n,e,t,i){const s=e.source.queryId;if(s!==null){const r=n.views.get(s);return f(r!=null,"SyncTree gave us an op for an invalid query."),ai(r,e,t,i)}else{let r=[];for(const o of n.views.values())r=r.concat(ai(o,e,t,i));return r}}function as(n,e,t,i,s){const r=e._queryIdentifier,o=n.views.get(r);if(!o){let l=ut(t,s?i:null),a=!1;l?a=!0:i instanceof g?(l=_n(t,i),a=!1):(l=g.EMPTY_NODE,a=!1);const c=Et(new ne(l,a,!1),new ne(i,s,!1));return new nl(e,c)}return o}function ul(n,e,t,i,s,r){const o=as(n,e,i,s,r);return n.views.has(e._queryIdentifier)||n.views.set(e._queryIdentifier,o),ol(o,t),ll(o,t)}function dl(n,e,t,i){const s=e._queryIdentifier,r=[];let o=[];const l=ie(n);if(s==="default")for(const[a,c]of n.views.entries())o=o.concat(li(c,t,i)),oi(c)&&(n.views.delete(a),c.query._queryParams.loadsAllData()||r.push(c.query));else{const a=n.views.get(s);a&&(o=o.concat(li(a,t,i)),oi(a)&&(n.views.delete(s),a.query._queryParams.loadsAllData()||r.push(a.query)))}return l&&!ie(n)&&r.push(new(cl())(e._repo,e._path)),{removed:r,events:o}}function cs(n){const e=[];for(const t of n.views.values())t.query._queryParams.loadsAllData()||e.push(t);return e}function J(n,e){let t=null;for(const i of n.views.values())t=t||rl(i,e);return t}function hs(n,e){if(e._queryParams.loadsAllData())return It(n);{const i=e._queryIdentifier;return n.views.get(i)}}function us(n,e){return hs(n,e)!=null}function ie(n){return It(n)!=null}function It(n){for(const e of n.views.values())if(e.query._queryParams.loadsAllData())return e;return null}/**
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
 */let pt;function fl(n){f(!pt,"__referenceConstructor has already been defined"),pt=n}function _l(){return f(pt,"Reference.ts has not been loaded"),pt}let pl=1;class ci{constructor(e){this.listenProvider_=e,this.syncPointTree_=new T(null),this.pendingWriteTree_=qo(),this.tagToQueryMap=new Map,this.queryToTagMap=new Map}}function ds(n,e,t,i,s){return Ao(n.pendingWriteTree_,e,t,i,s),s?Te(n,new ae(un(),e,t)):[]}function gl(n,e,t,i){Do(n.pendingWriteTree_,e,t,i);const s=T.fromObject(t);return Te(n,new ve(un(),e,s))}function $(n,e,t=!1){const i=Oo(n.pendingWriteTree_,e);if(Mo(n.pendingWriteTree_,e)){let r=new T(null);return i.snap!=null?r=r.set(C(),!0):A(i.children,o=>{r=r.set(new E(o),!0)}),Te(n,new ct(i.path,r,t))}else return[]}function $e(n,e,t){return Te(n,new ae(dn(),e,t))}function ml(n,e,t){const i=T.fromObject(t);return Te(n,new ve(dn(),e,i))}function yl(n,e){return Te(n,new Ge(dn(),e))}function vl(n,e,t){const i=vn(n,t);if(i){const s=Cn(i),r=s.path,o=s.queryId,l=O(r,e),a=new Ge(fn(o),l);return En(n,r,a)}else return[]}function gt(n,e,t,i,s=!1){const r=e._path,o=n.syncPointTree_.get(r);let l=[];if(o&&(e._queryIdentifier==="default"||us(o,e))){const a=dl(o,e,t,i);hl(o)&&(n.syncPointTree_=n.syncPointTree_.remove(r));const c=a.removed;if(l=a.events,!s){const h=c.findIndex(d=>d._queryParams.loadsAllData())!==-1,u=n.syncPointTree_.findOnPath(r,(d,_)=>ie(_));if(h&&!u){const d=n.syncPointTree_.subtree(r);if(!d.isEmpty()){const _=wl(d);for(let p=0;p<_.length;++p){const w=_[p],D=w.query,de=gs(n,w);n.listenProvider_.startListening(Me(D),Be(n,D),de.hashFn,de.onComplete)}}}!u&&c.length>0&&!i&&(h?n.listenProvider_.stopListening(Me(e),null):c.forEach(d=>{const _=n.queryToTagMap.get(Tt(d));n.listenProvider_.stopListening(Me(d),_)}))}Il(n,c)}return l}function fs(n,e,t,i){const s=vn(n,i);if(s!=null){const r=Cn(s),o=r.path,l=r.queryId,a=O(o,e),c=new ae(fn(l),a,t);return En(n,o,c)}else return[]}function Cl(n,e,t,i){const s=vn(n,i);if(s){const r=Cn(s),o=r.path,l=r.queryId,a=O(o,e),c=T.fromObject(t),h=new ve(fn(l),a,c);return En(n,o,h)}else return[]}function $t(n,e,t,i=!1){const s=e._path;let r=null,o=!1;n.syncPointTree_.foreachOnPath(s,(d,_)=>{const p=O(d,s);r=r||J(_,p),o=o||ie(_)});let l=n.syncPointTree_.get(s);l?(o=o||ie(l),r=r||J(l,C())):(l=new ls,n.syncPointTree_=n.syncPointTree_.set(s,l));let a;r!=null?a=!0:(a=!1,r=g.EMPTY_NODE,n.syncPointTree_.subtree(s).foreachChild((_,p)=>{const w=J(p,C());w&&(r=r.updateImmediateChild(_,w))}));const c=us(l,e);if(!c&&!e._queryParams.loadsAllData()){const d=Tt(e);f(!n.queryToTagMap.has(d),"View does not exist, but we have a tag");const _=Tl();n.queryToTagMap.set(d,_),n.tagToQueryMap.set(_,d)}const h=wt(n.pendingWriteTree_,s);let u=ul(l,e,t,h,r,a);if(!c&&!o&&!i){const d=hs(l,e);u=u.concat(Sl(n,e,d))}return u}function yn(n,e,t){const s=n.pendingWriteTree_,r=n.syncPointTree_.findOnPath(e,(o,l)=>{const a=O(o,e),c=J(l,a);if(c)return c});return ts(s,e,r,t,!0)}function El(n,e){const t=e._path;let i=null;n.syncPointTree_.foreachOnPath(t,(c,h)=>{const u=O(c,t);i=i||J(h,u)});let s=n.syncPointTree_.get(t);s?i=i||J(s,C()):(s=new ls,n.syncPointTree_=n.syncPointTree_.set(t,s));const r=i!=null,o=r?new ne(i,!0,!1):null,l=wt(n.pendingWriteTree_,e._path),a=as(s,e,l,r?o.getNode():g.EMPTY_NODE,r);return sl(a)}function Te(n,e){return _s(e,n.syncPointTree_,null,wt(n.pendingWriteTree_,C()))}function _s(n,e,t,i){if(y(n.path))return ps(n,e,t,i);{const s=e.get(C());t==null&&s!=null&&(t=J(s,C()));let r=[];const o=m(n.path),l=n.operationForChild(o),a=e.children.get(o);if(a&&l){const c=t?t.getImmediateChild(o):null,h=ns(i,o);r=r.concat(_s(l,a,c,h))}return s&&(r=r.concat(mn(s,n,i,t))),r}}function ps(n,e,t,i){const s=e.get(C());t==null&&s!=null&&(t=J(s,C()));let r=[];return e.children.inorderTraversal((o,l)=>{const a=t?t.getImmediateChild(o):null,c=ns(i,o),h=n.operationForChild(o);h&&(r=r.concat(ps(h,l,a,c)))}),s&&(r=r.concat(mn(s,n,i,t))),r}function gs(n,e){const t=e.query,i=Be(n,t);return{hashFn:()=>(il(e)||g.EMPTY_NODE).hash(),onComplete:s=>{if(s==="ok")return i?vl(n,t._path,i):yl(n,t._path);{const r=gr(s,t);return gt(n,t,null,r)}}}}function Be(n,e){const t=Tt(e);return n.queryToTagMap.get(t)}function Tt(n){return n._path.toString()+"$"+n._queryIdentifier}function vn(n,e){return n.tagToQueryMap.get(e)}function Cn(n){const e=n.indexOf("$");return f(e!==-1&&e<n.length-1,"Bad queryKey."),{queryId:n.substr(e+1),path:new E(n.substr(0,e))}}function En(n,e,t){const i=n.syncPointTree_.get(e);f(i,"Missing sync point for query tag that we're tracking");const s=wt(n.pendingWriteTree_,e);return mn(i,t,s,null)}function wl(n){return n.fold((e,t,i)=>{if(t&&ie(t))return[It(t)];{let s=[];return t&&(s=cs(t)),A(i,(r,o)=>{s=s.concat(o)}),s}})}function Me(n){return n._queryParams.loadsAllData()&&!n._queryParams.isDefault()?new(_l())(n._repo,n._path):n}function Il(n,e){for(let t=0;t<e.length;++t){const i=e[t];if(!i._queryParams.loadsAllData()){const s=Tt(i),r=n.queryToTagMap.get(s);n.queryToTagMap.delete(s),n.tagToQueryMap.delete(r)}}}function Tl(){return pl++}function Sl(n,e,t){const i=e._path,s=Be(n,e),r=gs(n,t),o=n.listenProvider_.startListening(Me(e),s,r.hashFn,r.onComplete),l=n.syncPointTree_.subtree(i);if(s)f(!ie(l.value),"If we're adding a query, it shouldn't be shadowed");else{const a=l.fold((c,h,u)=>{if(!y(c)&&h&&ie(h))return[It(h).query];{let d=[];return h&&(d=d.concat(cs(h).map(_=>_.query))),A(u,(_,p)=>{d=d.concat(p)}),d}});for(let c=0;c<a.length;++c){const h=a[c];n.listenProvider_.stopListening(Me(h),Be(n,h))}}return o}/**
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
 */class wn{constructor(e){this.node_=e}getImmediateChild(e){const t=this.node_.getImmediateChild(e);return new wn(t)}node(){return this.node_}}class In{constructor(e,t){this.syncTree_=e,this.path_=t}getImmediateChild(e){const t=N(this.path_,e);return new In(this.syncTree_,t)}node(){return yn(this.syncTree_,this.path_)}}const Nl=function(n){return n=n||{},n.timestamp=n.timestamp||new Date().getTime(),n},hi=function(n,e,t){if(!n||typeof n!="object")return n;if(f(".sv"in n,"Unexpected leaf node or priority contents"),typeof n[".sv"]=="string")return Rl(n[".sv"],e,t);if(typeof n[".sv"]=="object")return bl(n[".sv"],e);f(!1,"Unexpected server value: "+JSON.stringify(n,null,2))},Rl=function(n,e,t){switch(n){case"timestamp":return t.timestamp;default:f(!1,"Unexpected server value: "+n)}},bl=function(n,e,t){n.hasOwnProperty("increment")||f(!1,"Unexpected server value: "+JSON.stringify(n,null,2));const i=n.increment;typeof i!="number"&&f(!1,"Unexpected increment value: "+i);const s=e.node();if(f(s!==null&&typeof s<"u","Expected ChildrenNode.EMPTY_NODE for nulls"),!s.isLeafNode())return i;const o=s.getValue();return typeof o!="number"?i:o+i},ms=function(n,e,t,i){return Tn(e,new In(t,n),i)},ys=function(n,e,t){return Tn(n,new wn(e),t)};function Tn(n,e,t){const i=n.getPriority().val(),s=hi(i,e.getImmediateChild(".priority"),t);let r;if(n.isLeafNode()){const o=n,l=hi(o.getValue(),e,t);return l!==o.getValue()||s!==o.getPriority().val()?new k(l,R(s)):n}else{const o=n;return r=o,s!==o.getPriority().val()&&(r=r.updatePriority(new k(s))),o.forEachChild(S,(l,a)=>{const c=Tn(a,e.getImmediateChild(l),t);c!==a&&(r=r.updateImmediateChild(l,c))}),r}}/**
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
 */class Sn{constructor(e="",t=null,i={children:{},childCount:0}){this.name=e,this.parent=t,this.node=i}}function Nn(n,e){let t=e instanceof E?e:new E(e),i=n,s=m(t);for(;s!==null;){const r=ge(i.node.children,s)||{children:{},childCount:0};i=new Sn(s,i,r),t=I(t),s=m(t)}return i}function Se(n){return n.node.value}function vs(n,e){n.node.value=e,Xt(n)}function Cs(n){return n.node.childCount>0}function kl(n){return Se(n)===void 0&&!Cs(n)}function St(n,e){A(n.node.children,(t,i)=>{e(new Sn(t,n,i))})}function Es(n,e,t,i){t&&e(n),St(n,s=>{Es(s,e,!0)})}function Pl(n,e,t){let i=n.parent;for(;i!==null;){if(e(i))return!0;i=i.parent}return!1}function Xe(n){return new E(n.parent===null?n.name:Xe(n.parent)+"/"+n.name)}function Xt(n){n.parent!==null&&xl(n.parent,n.name,n)}function xl(n,e,t){const i=kl(t),s=H(n.node.children,e);i&&s?(delete n.node.children[e],n.node.childCount--,Xt(n)):!i&&!s&&(n.node.children[e]=t.node,n.node.childCount++,Xt(n))}/**
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
 */const Al=/[\[\].#$\/\u0000-\u001F\u007F]/,Dl=/[\[\].#$\u0000-\u001F\u007F]/,Ft=10*1024*1024,Rn=function(n){return typeof n=="string"&&n.length!==0&&!Al.test(n)},ws=function(n){return typeof n=="string"&&n.length!==0&&!Dl.test(n)},Ol=function(n){return n&&(n=n.replace(/^\/*\.info(\/|$)/,"/")),ws(n)},mt=function(n){return n===null||typeof n=="string"||typeof n=="number"&&!vt(n)||n&&typeof n=="object"&&H(n,".sv")},He=function(n,e,t,i){i&&e===void 0||Nt(me(n,"value"),e,t)},Nt=function(n,e,t){const i=t instanceof E?new $r(t,n):t;if(e===void 0)throw new Error(n+"contains undefined "+re(i));if(typeof e=="function")throw new Error(n+"contains a function "+re(i)+" with contents = "+e.toString());if(vt(e))throw new Error(n+"contains "+e.toString()+" "+re(i));if(typeof e=="string"&&e.length>Ft/3&&yt(e)>Ft)throw new Error(n+"contains a string greater than "+Ft+" utf8 bytes "+re(i)+" ('"+e.substring(0,50)+"...')");if(e&&typeof e=="object"){let s=!1,r=!1;if(A(e,(o,l)=>{if(o===".value")s=!0;else if(o!==".priority"&&o!==".sv"&&(r=!0,!Rn(o)))throw new Error(n+" contains an invalid key ("+o+") "+re(i)+`.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"`);Xr(i,o),Nt(n,l,i),Jr(i)}),s&&r)throw new Error(n+' contains ".value" child '+re(i)+" in addition to actual children.")}},Ml=function(n,e){let t,i;for(t=0;t<e.length;t++){i=e[t];const r=Fe(i);for(let o=0;o<r.length;o++)if(!(r[o]===".priority"&&o===r.length-1)){if(!Rn(r[o]))throw new Error(n+"contains an invalid key ("+r[o]+") in path "+i.toString()+`. Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"`)}}e.sort(jr);let s=null;for(t=0;t<e.length;t++){if(i=e[t],s!==null&&F(s,i))throw new Error(n+"contains a path "+s.toString()+" that is ancestor of another path "+i.toString());s=i}},Is=function(n,e,t,i){const s=me(n,"values");if(!(e&&typeof e=="object")||Array.isArray(e))throw new Error(s+" must be an object containing the children to replace.");const r=[];A(e,(o,l)=>{const a=new E(o);if(Nt(s,l,N(t,a)),rn(a)===".priority"&&!mt(l))throw new Error(s+"contains an invalid value for '"+a.toString()+"', which must be a valid Firebase priority (a string, finite number, server value, or null).");r.push(a)}),Ml(s,r)},Ll=function(n,e,t){if(vt(e))throw new Error(me(n,"priority")+"is "+e.toString()+", but must be a valid Firebase priority (a string, finite number, server value, or null).");if(!mt(e))throw new Error(me(n,"priority")+"must be a valid Firebase priority (a string, finite number, server value, or null).")},Ts=function(n,e,t,i){if(!ws(t))throw new Error(me(n,e)+'was an invalid path = "'+t+`". Paths must be non-empty strings and can't contain ".", "#", "$", "[", or "]"`)},Fl=function(n,e,t,i){t&&(t=t.replace(/^\/*\.info(\/|$)/,"/")),Ts(n,e,t)},le=function(n,e){if(m(e)===".info")throw new Error(n+" failed = Can't modify data under /.info/")},Wl=function(n,e){const t=e.path.toString();if(typeof e.repoInfo.host!="string"||e.repoInfo.host.length===0||!Rn(e.repoInfo.namespace)&&e.repoInfo.host.split(":")[0]!=="localhost"||t.length!==0&&!Ol(t))throw new Error(me(n,"url")+`must be a valid firebase URL and the path can't contain ".", "#", "$", "[", or "]".`)};/**
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
 */class Ul{constructor(){this.eventLists_=[],this.recursionDepth_=0}}function Rt(n,e){let t=null;for(let i=0;i<e.length;i++){const s=e[i],r=s.getPath();t!==null&&!on(r,t.path)&&(n.eventLists_.push(t),t=null),t===null&&(t={events:[],path:r}),t.events.push(s)}t&&n.eventLists_.push(t)}function Ss(n,e,t){Rt(n,t),Ns(n,i=>on(i,e))}function W(n,e,t){Rt(n,t),Ns(n,i=>F(i,e)||F(e,i))}function Ns(n,e){n.recursionDepth_++;let t=!0;for(let i=0;i<n.eventLists_.length;i++){const s=n.eventLists_[i];if(s){const r=s.path;e(r)?(Vl(n.eventLists_[i]),n.eventLists_[i]=null):t=!1}}t&&(n.eventLists_=[]),n.recursionDepth_--}function Vl(n){for(let e=0;e<n.events.length;e++){const t=n.events[e];if(t!==null){n.events[e]=null;const i=t.getEventRunner();xe&&x("event: "+t.toString()),we(i)}}}/**
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
 */const Rs="repo_interrupt",Gl=25;class Bl{constructor(e,t,i,s){this.repoInfo_=e,this.forceRestClient_=t,this.authTokenProvider_=i,this.appCheckProvider_=s,this.dataUpdateCount=0,this.statsListener_=null,this.eventQueue_=new Ul,this.nextWriteId_=1,this.interceptServerDataCallback_=null,this.onDisconnect_=at(),this.transactionQueueTree_=new Sn,this.persistentConnection_=null,this.key=this.repoInfo_.toURLString()}toString(){return(this.repoInfo_.secure?"https://":"http://")+this.repoInfo_.host}}function Hl(n,e,t){if(n.stats_=nn(n.repoInfo_),n.forceRestClient_||Cr())n.server_=new lt(n.repoInfo_,(i,s,r,o)=>{ui(n,i,s,r,o)},n.authTokenProvider_,n.appCheckProvider_),setTimeout(()=>di(n,!0),0);else{if(typeof t<"u"&&t!==null){if(typeof t!="object")throw new Error("Only objects are supported for option databaseAuthVariableOverride");try{b(t)}catch(i){throw new Error("Invalid authOverride provided: "+i)}}n.persistentConnection_=new Y(n.repoInfo_,e,(i,s,r,o)=>{ui(n,i,s,r,o)},i=>{di(n,i)},i=>{ql(n,i)},n.authTokenProvider_,n.appCheckProvider_,t),n.server_=n.persistentConnection_}n.authTokenProvider_.addTokenChangeListener(i=>{n.server_.refreshAuthToken(i)}),n.appCheckProvider_.addTokenChangeListener(i=>{n.server_.refreshAppCheckToken(i.token)}),n.statsReporter_=Sr(n.repoInfo_,()=>new No(n.stats_,n.server_)),n.infoData_=new Eo,n.infoSyncTree_=new ci({startListening:(i,s,r,o)=>{let l=[];const a=n.infoData_.getNode(i._path);return a.isEmpty()||(l=$e(n.infoSyncTree_,i._path,a),setTimeout(()=>{o("ok")},0)),l},stopListening:()=>{}}),bn(n,"connected",!1),n.serverSyncTree_=new ci({startListening:(i,s,r,o)=>(n.server_.listen(i,r,s,(l,a)=>{const c=o(l,a);W(n.eventQueue_,i._path,c)}),[]),stopListening:(i,s)=>{n.server_.unlisten(i,s)}})}function bs(n){const t=n.infoData_.getNode(new E(".info/serverTimeOffset")).val()||0;return new Date().getTime()+t}function bt(n){return Nl({timestamp:bs(n)})}function ui(n,e,t,i,s){n.dataUpdateCount++;const r=new E(e);t=n.interceptServerDataCallback_?n.interceptServerDataCallback_(e,t):t;let o=[];if(s)if(i){const a=it(t,c=>R(c));o=Cl(n.serverSyncTree_,r,a,s)}else{const a=R(t);o=fs(n.serverSyncTree_,r,a,s)}else if(i){const a=it(t,c=>R(c));o=ml(n.serverSyncTree_,r,a)}else{const a=R(t);o=$e(n.serverSyncTree_,r,a)}let l=r;o.length>0&&(l=Ee(n,r)),W(n.eventQueue_,l,o)}function di(n,e){bn(n,"connected",e),e===!1&&zl(n)}function ql(n,e){A(e,(t,i)=>{bn(n,t,i)})}function bn(n,e,t){const i=new E("/.info/"+e),s=R(t);n.infoData_.updateSnapshot(i,s);const r=$e(n.infoSyncTree_,i,s);W(n.eventQueue_,i,r)}function kn(n){return n.nextWriteId_++}function Ql(n,e,t){const i=El(n.serverSyncTree_,e);return i!=null?Promise.resolve(i):n.server_.get(e).then(s=>{const r=R(s).withIndex(e._queryParams.getIndex());$t(n.serverSyncTree_,e,t,!0);let o;if(e._queryParams.loadsAllData())o=$e(n.serverSyncTree_,e._path,r);else{const l=Be(n.serverSyncTree_,e);o=fs(n.serverSyncTree_,e._path,r,l)}return W(n.eventQueue_,e._path,o),gt(n.serverSyncTree_,e,t,null,!0),r},s=>(Je(n,"get for query "+b(e)+" failed: "+s),Promise.reject(new Error(s))))}function Yl(n,e,t,i,s){Je(n,"set",{path:e.toString(),value:t,priority:i});const r=bt(n),o=R(t,i),l=yn(n.serverSyncTree_,e),a=ys(o,l,r),c=kn(n),h=ds(n.serverSyncTree_,e,a,c,!0);Rt(n.eventQueue_,h),n.server_.put(e.toString(),o.val(!0),(d,_)=>{const p=d==="ok";p||M("set at "+e+" failed: "+d);const w=$(n.serverSyncTree_,c,!p);W(n.eventQueue_,e,w),se(n,s,d,_)});const u=xn(n,e);Ee(n,u),W(n.eventQueue_,u,[])}function Kl(n,e,t,i){Je(n,"update",{path:e.toString(),value:t});let s=!0;const r=bt(n),o={};if(A(t,(l,a)=>{s=!1,o[l]=ms(N(e,l),R(a),n.serverSyncTree_,r)}),s)x("update() called with empty data.  Don't do anything."),se(n,i,"ok",void 0);else{const l=kn(n),a=gl(n.serverSyncTree_,e,o,l);Rt(n.eventQueue_,a),n.server_.merge(e.toString(),t,(c,h)=>{const u=c==="ok";u||M("update at "+e+" failed: "+c);const d=$(n.serverSyncTree_,l,!u),_=d.length>0?Ee(n,e):e;W(n.eventQueue_,_,d),se(n,i,c,h)}),A(t,c=>{const h=xn(n,N(e,c));Ee(n,h)}),W(n.eventQueue_,e,[])}}function zl(n){Je(n,"onDisconnectEvents");const e=bt(n),t=at();qt(n.onDisconnect_,C(),(s,r)=>{const o=ms(s,r,n.serverSyncTree_,e);Ie(t,s,o)});let i=[];qt(t,C(),(s,r)=>{i=i.concat($e(n.serverSyncTree_,s,r));const o=xn(n,s);Ee(n,o)}),n.onDisconnect_=at(),W(n.eventQueue_,C(),i)}function jl(n,e,t){n.server_.onDisconnectCancel(e.toString(),(i,s)=>{i==="ok"&&Ht(n.onDisconnect_,e),se(n,t,i,s)})}function fi(n,e,t,i){const s=R(t);n.server_.onDisconnectPut(e.toString(),s.val(!0),(r,o)=>{r==="ok"&&Ie(n.onDisconnect_,e,s),se(n,i,r,o)})}function $l(n,e,t,i,s){const r=R(t,i);n.server_.onDisconnectPut(e.toString(),r.val(!0),(o,l)=>{o==="ok"&&Ie(n.onDisconnect_,e,r),se(n,s,o,l)})}function Xl(n,e,t,i){if(Ut(t)){x("onDisconnect().update() called with empty data.  Don't do anything."),se(n,i,"ok",void 0);return}n.server_.onDisconnectMerge(e.toString(),t,(s,r)=>{s==="ok"&&A(t,(o,l)=>{const a=R(l);Ie(n.onDisconnect_,N(e,o),a)}),se(n,i,s,r)})}function Jl(n,e,t){let i;m(e._path)===".info"?i=$t(n.infoSyncTree_,e,t):i=$t(n.serverSyncTree_,e,t),Ss(n.eventQueue_,e._path,i)}function _i(n,e,t){let i;m(e._path)===".info"?i=gt(n.infoSyncTree_,e,t):i=gt(n.serverSyncTree_,e,t),Ss(n.eventQueue_,e._path,i)}function ks(n){n.persistentConnection_&&n.persistentConnection_.interrupt(Rs)}function Zl(n){n.persistentConnection_&&n.persistentConnection_.resume(Rs)}function Je(n,...e){let t="";n.persistentConnection_&&(t=n.persistentConnection_.id+":"),x(t,...e)}function se(n,e,t,i){e&&we(()=>{if(t==="ok")e(null);else{const s=(t||"error").toUpperCase();let r=s;i&&(r+=": "+i);const o=new Error(r);o.code=s,e(o)}})}function Ps(n,e,t){return yn(n.serverSyncTree_,e,t)||g.EMPTY_NODE}function Pn(n,e=n.transactionQueueTree_){if(e||kt(n,e),Se(e)){const t=As(n,e);f(t.length>0,"Sending zero length transaction queue"),t.every(s=>s.status===0)&&ea(n,Xe(e),t)}else Cs(e)&&St(e,t=>{Pn(n,t)})}function ea(n,e,t){const i=t.map(c=>c.currentWriteId),s=Ps(n,e,i);let r=s;const o=s.hash();for(let c=0;c<t.length;c++){const h=t[c];f(h.status===0,"tryToSendTransactionQueue_: items in queue should all be run."),h.status=1,h.retryCount++;const u=O(e,h.path);r=r.updateChild(u,h.currentOutputSnapshotRaw)}const l=r.val(!0),a=e;n.server_.put(a.toString(),l,c=>{Je(n,"transaction put response",{path:a.toString(),status:c});let h=[];if(c==="ok"){const u=[];for(let d=0;d<t.length;d++)t[d].status=2,h=h.concat($(n.serverSyncTree_,t[d].currentWriteId)),t[d].onComplete&&u.push(()=>t[d].onComplete(null,!0,t[d].currentOutputSnapshotResolved)),t[d].unwatcher();kt(n,Nn(n.transactionQueueTree_,e)),Pn(n,n.transactionQueueTree_),W(n.eventQueue_,e,h);for(let d=0;d<u.length;d++)we(u[d])}else{if(c==="datastale")for(let u=0;u<t.length;u++)t[u].status===3?t[u].status=4:t[u].status=0;else{M("transaction at "+a.toString()+" failed: "+c);for(let u=0;u<t.length;u++)t[u].status=4,t[u].abortReason=c}Ee(n,e)}},o)}function Ee(n,e){const t=xs(n,e),i=Xe(t),s=As(n,t);return ta(n,s,i),i}function ta(n,e,t){if(e.length===0)return;const i=[];let s=[];const o=e.filter(l=>l.status===0).map(l=>l.currentWriteId);for(let l=0;l<e.length;l++){const a=e[l],c=O(t,a.path);let h=!1,u;if(f(c!==null,"rerunTransactionsUnderNode_: relativePath should not be null."),a.status===4)h=!0,u=a.abortReason,s=s.concat($(n.serverSyncTree_,a.currentWriteId,!0));else if(a.status===0)if(a.retryCount>=Gl)h=!0,u="maxretry",s=s.concat($(n.serverSyncTree_,a.currentWriteId,!0));else{const d=Ps(n,a.path,o);a.currentInputSnapshot=d;const _=e[l].update(d.val());if(_!==void 0){Nt("transaction failed: Data returned ",_,a.path);let p=R(_);typeof _=="object"&&_!=null&&H(_,".priority")||(p=p.updatePriority(d.getPriority()));const D=a.currentWriteId,de=bt(n),Ze=ys(p,d,de);a.currentOutputSnapshotRaw=p,a.currentOutputSnapshotResolved=Ze,a.currentWriteId=kn(n),o.splice(o.indexOf(D),1),s=s.concat(ds(n.serverSyncTree_,a.path,Ze,a.currentWriteId,a.applyLocally)),s=s.concat($(n.serverSyncTree_,D,!0))}else h=!0,u="nodata",s=s.concat($(n.serverSyncTree_,a.currentWriteId,!0))}W(n.eventQueue_,t,s),s=[],h&&(e[l].status=2,function(d){setTimeout(d,Math.floor(0))}(e[l].unwatcher),e[l].onComplete&&(u==="nodata"?i.push(()=>e[l].onComplete(null,!1,e[l].currentInputSnapshot)):i.push(()=>e[l].onComplete(new Error(u),!1,null))))}kt(n,n.transactionQueueTree_);for(let l=0;l<i.length;l++)we(i[l]);Pn(n,n.transactionQueueTree_)}function xs(n,e){let t,i=n.transactionQueueTree_;for(t=m(e);t!==null&&Se(i)===void 0;)i=Nn(i,t),e=I(e),t=m(e);return i}function As(n,e){const t=[];return Ds(n,e,t),t.sort((i,s)=>i.order-s.order),t}function Ds(n,e,t){const i=Se(e);if(i)for(let s=0;s<i.length;s++)t.push(i[s]);St(e,s=>{Ds(n,s,t)})}function kt(n,e){const t=Se(e);if(t){let i=0;for(let s=0;s<t.length;s++)t[s].status!==2&&(t[i]=t[s],i++);t.length=i,vs(e,t.length>0?t:void 0)}St(e,i=>{kt(n,i)})}function xn(n,e){const t=Xe(xs(n,e)),i=Nn(n.transactionQueueTree_,e);return Pl(i,s=>{Wt(n,s)}),Wt(n,i),Es(i,s=>{Wt(n,s)}),t}function Wt(n,e){const t=Se(e);if(t){const i=[];let s=[],r=-1;for(let o=0;o<t.length;o++)t[o].status===3||(t[o].status===1?(f(r===o-1,"All SENT items should be at beginning of queue."),r=o,t[o].status=3,t[o].abortReason="set"):(f(t[o].status===0,"Unexpected transaction status in abort"),t[o].unwatcher(),s=s.concat($(n.serverSyncTree_,t[o].currentWriteId,!0)),t[o].onComplete&&i.push(t[o].onComplete.bind(null,new Error("set"),!1,null))));r===-1?vs(e,void 0):t.length=r+1,W(n.eventQueue_,Xe(e),s);for(let o=0;o<i.length;o++)we(i[o])}}/**
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
 */function na(n){let e="";const t=n.split("/");for(let i=0;i<t.length;i++)if(t[i].length>0){let s=t[i];try{s=decodeURIComponent(s.replace(/\+/g," "))}catch{}e+="/"+s}return e}function ia(n){const e={};n.charAt(0)==="?"&&(n=n.substring(1));for(const t of n.split("&")){if(t.length===0)continue;const i=t.split("=");i.length===2?e[decodeURIComponent(i[0])]=decodeURIComponent(i[1]):M(`Invalid query segment '${t}' in query '${n}'`)}return e}const pi=function(n,e){const t=sa(n),i=t.namespace;t.domain==="firebase.com"&&z(t.host+" is no longer supported. Please use <YOUR FIREBASE>.firebaseio.com instead"),(!i||i==="undefined")&&t.domain!=="localhost"&&z("Cannot parse Firebase url. Please use https://<YOUR FIREBASE>.firebaseio.com"),t.secure||ur();const s=t.scheme==="ws"||t.scheme==="wss";return{repoInfo:new Di(t.host,t.secure,i,s,e,"",i!==t.subdomain),path:new E(t.pathString)}},sa=function(n){let e="",t="",i="",s="",r="",o=!0,l="https",a=443;if(typeof n=="string"){let c=n.indexOf("//");c>=0&&(l=n.substring(0,c-1),n=n.substring(c+2));let h=n.indexOf("/");h===-1&&(h=n.length);let u=n.indexOf("?");u===-1&&(u=n.length),e=n.substring(0,Math.min(h,u)),h<u&&(s=na(n.substring(h,u)));const d=ia(n.substring(Math.min(n.length,u)));c=e.indexOf(":"),c>=0?(o=l==="https"||l==="wss",a=parseInt(e.substring(c+1),10)):c=e.length;const _=e.slice(0,c);if(_.toLowerCase()==="localhost")t="localhost";else if(_.split(".").length<=2)t=_;else{const p=e.indexOf(".");i=e.substring(0,p).toLowerCase(),t=e.substring(p+1),r=i}"ns"in d&&(r=d.ns)}return{host:e,port:a,domain:t,subdomain:i,secure:o,scheme:l,pathString:s,namespace:r}};/**
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
 */const gi="-0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ_abcdefghijklmnopqrstuvwxyz",ra=function(){let n=0;const e=[];return function(t){const i=t===n;n=t;let s;const r=new Array(8);for(s=7;s>=0;s--)r[s]=gi.charAt(t%64),t=Math.floor(t/64);f(t===0,"Cannot push at time == 0");let o=r.join("");if(i){for(s=11;s>=0&&e[s]===63;s--)e[s]=0;e[s]++}else for(s=0;s<12;s++)e[s]=Math.floor(Math.random()*64);for(s=0;s<12;s++)o+=gi.charAt(e[s]);return f(o.length===20,"nextPushId: Length should be 20."),o}}();/**
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
 */class oa{constructor(e,t,i,s){this.eventType=e,this.eventRegistration=t,this.snapshot=i,this.prevName=s}getPath(){const e=this.snapshot.ref;return this.eventType==="value"?e._path:e.parent._path}getEventType(){return this.eventType}getEventRunner(){return this.eventRegistration.getEventRunner(this)}toString(){return this.getPath().toString()+":"+this.eventType+":"+b(this.snapshot.exportVal())}}class la{constructor(e,t,i){this.eventRegistration=e,this.error=t,this.path=i}getPath(){return this.path}getEventType(){return"cancel"}getEventRunner(){return this.eventRegistration.getEventRunner(this)}toString(){return this.path.toString()+":cancel"}}/**
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
 */class Os{constructor(e,t){this.snapshotCallback=e,this.cancelCallback=t}onValue(e,t){this.snapshotCallback.call(null,e,t)}onCancel(e){return f(this.hasCancelCallback,"Raising a cancel event on a listener with no cancel callback"),this.cancelCallback.call(null,e)}get hasCancelCallback(){return!!this.cancelCallback}matches(e){return this.snapshotCallback===e.snapshotCallback||this.snapshotCallback.userCallback!==void 0&&this.snapshotCallback.userCallback===e.snapshotCallback.userCallback&&this.snapshotCallback.context===e.snapshotCallback.context}}/**
 * @license
 * Copyright 2021 Google LLC
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
 */class aa{constructor(e,t){this._repo=e,this._path=t}cancel(){const e=new q;return jl(this._repo,this._path,e.wrapCallback(()=>{})),e.promise}remove(){le("OnDisconnect.remove",this._path);const e=new q;return fi(this._repo,this._path,null,e.wrapCallback(()=>{})),e.promise}set(e){le("OnDisconnect.set",this._path),He("OnDisconnect.set",e,this._path,!1);const t=new q;return fi(this._repo,this._path,e,t.wrapCallback(()=>{})),t.promise}setWithPriority(e,t){le("OnDisconnect.setWithPriority",this._path),He("OnDisconnect.setWithPriority",e,this._path,!1),Ll("OnDisconnect.setWithPriority",t);const i=new q;return $l(this._repo,this._path,e,t,i.wrapCallback(()=>{})),i.promise}update(e){le("OnDisconnect.update",this._path),Is("OnDisconnect.update",e,this._path);const t=new q;return Xl(this._repo,this._path,e,t.wrapCallback(()=>{})),t.promise}}/**
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
 */class Ne{constructor(e,t,i,s){this._repo=e,this._path=t,this._queryParams=i,this._orderByCalled=s}get key(){return y(this._path)?null:rn(this._path)}get ref(){return new j(this._repo,this._path)}get _queryIdentifier(){const e=Zn(this._queryParams),t=en(e);return t==="{}"?"default":t}get _queryObject(){return Zn(this._queryParams)}isEqual(e){if(e=B(e),!(e instanceof Ne))return!1;const t=this._repo===e._repo,i=on(this._path,e._path),s=this._queryIdentifier===e._queryIdentifier;return t&&i&&s}toJSON(){return this.toString()}toString(){return this._repo.toString()+zr(this._path)}}function ca(n,e){if(n._orderByCalled===!0)throw new Error(e+": You can't combine multiple orderBy calls.")}function Ms(n){let e=null,t=null;if(n.hasStart()&&(e=n.getIndexStartValue()),n.hasEnd()&&(t=n.getIndexEndValue()),n.getIndex()===K){const i="Query: When ordering by key, you may only pass one argument to startAt(), endAt(), or equalTo().",s="Query: When ordering by key, the argument passed to startAt(), startAfter(), endAt(), endBefore(), or equalTo() must be a string.";if(n.hasStart()){if(n.getIndexStartName()!==Z)throw new Error(i);if(typeof e!="string")throw new Error(s)}if(n.hasEnd()){if(n.getIndexEndName()!==ee)throw new Error(i);if(typeof t!="string")throw new Error(s)}}else if(n.getIndex()===S){if(e!=null&&!mt(e)||t!=null&&!mt(t))throw new Error("Query: When ordering by priority, the first argument passed to startAt(), startAfter() endAt(), endBefore(), or equalTo() must be a valid priority value (null, a number, or a string).")}else if(f(n.getIndex()instanceof ji||n.getIndex()===$i,"unknown index type."),e!=null&&typeof e=="object"||t!=null&&typeof t=="object")throw new Error("Query: First argument passed to startAt(), startAfter(), endAt(), endBefore(), or equalTo() cannot be an object.")}function ha(n){if(n.hasStart()&&n.hasEnd()&&n.hasLimit()&&!n.hasAnchoredLimit())throw new Error("Query: Can't combine startAt(), startAfter(), endAt(), endBefore(), and limit(). Use limitToFirst() or limitToLast() instead.")}class j extends Ne{constructor(e,t){super(e,t,new hn,!1)}get parent(){const e=Bi(this._path);return e===null?null:new j(this._repo,e)}get root(){let e=this;for(;e.parent!==null;)e=e.parent;return e}}class qe{constructor(e,t,i){this._node=e,this.ref=t,this._index=i}get priority(){return this._node.getPriority().val()}get key(){return this.ref.key}get size(){return this._node.numChildren()}child(e){const t=new E(e),i=Qe(this.ref,e);return new qe(this._node.getChild(t),i,S)}exists(){return!this._node.isEmpty()}exportVal(){return this._node.val(!0)}forEach(e){return this._node.isLeafNode()?!1:!!this._node.forEachChild(this._index,(i,s)=>e(new qe(s,Qe(this.ref,i),S)))}hasChild(e){const t=new E(e);return!this._node.getChild(t).isEmpty()}hasChildren(){return this._node.isLeafNode()?!1:!this._node.isEmpty()}toJSON(){return this.exportVal()}val(){return this._node.val()}}function Ra(n,e){return n=B(n),n._checkNotDeleted("ref"),e!==void 0?Qe(n._root,e):n._root}function Qe(n,e){return n=B(n),m(n._path)===null?Fl("child","path",e):Ts("child","path",e),new j(n._repo,N(n._path,e))}function ba(n){return n=B(n),new aa(n._repo,n._path)}function ka(n,e){n=B(n),le("push",n._path),He("push",e,n._path,!0);const t=bs(n._repo),i=ra(t),s=Qe(n,i),r=Qe(n,i);let o;return o=Promise.resolve(r),s.then=o.then.bind(o),s.catch=o.then.bind(o,void 0),s}function Pa(n){return le("remove",n._path),ua(n,null)}function ua(n,e){n=B(n),le("set",n._path),He("set",e,n._path,!1);const t=new q;return Yl(n._repo,n._path,e,null,t.wrapCallback(()=>{})),t.promise}function xa(n,e){Is("update",e,n._path);const t=new q;return Kl(n._repo,n._path,e,t.wrapCallback(()=>{})),t.promise}function Aa(n){n=B(n);const e=new Os(()=>{}),t=new Pt(e);return Ql(n._repo,n,t).then(i=>new qe(i,new j(n._repo,n._path),n._queryParams.getIndex()))}class Pt{constructor(e){this.callbackContext=e}respondsTo(e){return e==="value"}createEvent(e,t){const i=t._queryParams.getIndex();return new oa("value",this,new qe(e.snapshotNode,new j(t._repo,t._path),i))}getEventRunner(e){return e.getEventType()==="cancel"?()=>this.callbackContext.onCancel(e.error):()=>this.callbackContext.onValue(e.snapshot,null)}createCancelEvent(e,t){return this.callbackContext.hasCancelCallback?new la(this,e,t):null}matches(e){return e instanceof Pt?!e.callbackContext||!this.callbackContext?!0:e.callbackContext.matches(this.callbackContext):!1}hasAnyCallback(){return this.callbackContext!==null}}function da(n,e,t,i,s){let r;if(typeof i=="object"&&(r=void 0,s=i),typeof i=="function"&&(r=i),s&&s.onlyOnce){const a=t,c=(h,u)=>{_i(n._repo,n,l),a(h,u)};c.userCallback=t.userCallback,c.context=t.context,t=c}const o=new Os(t,r||void 0),l=new Pt(o);return Jl(n._repo,n,l),()=>_i(n._repo,n,l)}function Da(n,e,t,i){return da(n,"value",e,t,i)}class An{}class fa extends An{constructor(e,t){super(),this._value=e,this._key=t,this.type="endBefore"}_apply(e){He("endBefore",this._value,e._path,!1);const t=vo(e._queryParams,this._value,this._key);if(ha(t),Ms(t),e._queryParams.hasEnd())throw new Error("endBefore: Starting point was already set (by another call to endAt, endBefore or equalTo).");return new Ne(e._repo,e._path,t,e._orderByCalled)}}function Oa(n,e){return new fa(n,e)}class _a extends An{constructor(e){super(),this._limit=e,this.type="limitToLast"}_apply(e){if(e._queryParams.hasLimit())throw new Error("limitToLast: Limit was already set (by another call to limitToFirst or limitToLast).");return new Ne(e._repo,e._path,yo(e._queryParams,this._limit),e._orderByCalled)}}function Ma(n){if(typeof n!="number"||Math.floor(n)!==n||n<=0)throw new Error("limitToLast: First argument must be a positive integer.");return new _a(n)}class pa extends An{constructor(){super(...arguments),this.type="orderByKey"}_apply(e){ca(e,"orderByKey");const t=Co(e._queryParams,K);return Ms(t),new Ne(e._repo,e._path,t,!0)}}function La(){return new pa}function Fa(n,...e){let t=B(n);for(const i of e)t=i._apply(t);return t}al(j);fl(j);/**
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
 */const ga="FIREBASE_DATABASE_EMULATOR_HOST",Jt={};let ma=!1;function ya(n,e,t,i){const s=e.lastIndexOf(":"),r=e.substring(0,s),o=yi(r);n.repoInfo_=new Di(e,o,n.repoInfo_.namespace,n.repoInfo_.webSocketOnly,n.repoInfo_.nodeAdmin,n.repoInfo_.persistenceKey,n.repoInfo_.includeNamespaceInQueryParams,!0,t),i&&(n.authTokenProvider_=i)}function va(n,e,t,i,s){let r=i||n.options.databaseURL;r===void 0&&(n.options.projectId||z("Can't determine Firebase Database URL. Be sure to include  a Project ID when calling firebase.initializeApp()."),x("Using default host for project ",n.options.projectId),r=`${n.options.projectId}-default-rtdb.firebaseio.com`);let o=pi(r,s),l=o.repoInfo,a;typeof process<"u"&&On&&(a=On[ga]),a?(r=`http://${a}?ns=${l.namespace}`,o=pi(r,s),l=o.repoInfo):o.repoInfo.secure;const c=new wr(n.name,n.options,e);Wl("Invalid Firebase Database URL",o),y(o.path)||z("Database URL must point to the root of a Firebase Database (not including a child path).");const h=Ea(l,n,c,new Er(n,t));return new wa(h,n)}function Ca(n,e){const t=Jt[e];(!t||t[n.key]!==n)&&z(`Database ${e}(${n.repoInfo_}) has already been deleted.`),ks(n),delete t[n.key]}function Ea(n,e,t,i){let s=Jt[e.name];s||(s={},Jt[e.name]=s);let r=s[n.toURLString()];return r&&z("Database initialized multiple times. Please make sure the format of the database URL matches with each database() call."),r=new Bl(n,ma,t,i),s[n.toURLString()]=r,r}class wa{constructor(e,t){this._repoInternal=e,this.app=t,this.type="database",this._instanceStarted=!1}get _repo(){return this._instanceStarted||(Hl(this._repoInternal,this.app.options.appId,this.app.options.databaseAuthVariableOverride),this._instanceStarted=!0),this._repoInternal}get _root(){return this._rootInternal||(this._rootInternal=new j(this._repo,C())),this._rootInternal}_delete(){return this._rootInternal!==null&&(Ca(this._repo,this.app.name),this._repoInternal=null,this._rootInternal=null),Promise.resolve()}_checkNotDeleted(e){this._rootInternal===null&&z("Cannot call "+e+" on a deleted database.")}}function Wa(n=er(),e){const t=Js(n,"database").getImmediate({identifier:e});if(!t._instanceStarted){const i=Zs("database");i&&Ia(t,...i)}return t}function Ia(n,e,t,i={}){n=B(n),n._checkNotDeleted("useEmulator");const s=`${e}:${t}`,r=n._repoInternal;if(n._instanceStarted){if(s===n._repoInternal.repoInfo_.host&&tr(i,r.repoInfo_.emulatorOptions))return;z("connectDatabaseEmulator() cannot initialize or alter the emulator configuration after the database instance has started.")}let o;if(r.repoInfo_.nodeAdmin)i.mockUserToken&&z('mockUserToken is not supported by the Admin SDK. For client access with mock users, please use the "firebase" package instead of "firebase-admin".'),o=new nt(nt.OWNER);else if(i.mockUserToken){const l=typeof i.mockUserToken=="string"?i.mockUserToken:nr(i.mockUserToken,n.app.options.projectId);o=new nt(l)}yi(e)&&ir(e),ya(r,s,i,o)}function Ua(n){n=B(n),n._checkNotDeleted("goOffline"),ks(n._repo)}function Va(n){n=B(n),n._checkNotDeleted("goOnline"),Zl(n._repo)}/**
 * @license
 * Copyright 2021 Google LLC
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
 */function Ta(n){rr(sr),Ws(new Us("database",(e,{instanceIdentifier:t})=>{const i=e.getProvider("app").getImmediate(),s=e.getProvider("auth-internal"),r=e.getProvider("app-check-internal");return va(i,s,r,t)},"PUBLIC").setMultipleInstances(!0)),Dn(Mn,Ln,n),Dn(Mn,Ln,"esm2020")}/**
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
 */const Sa={".sv":"timestamp"};function Ga(){return Sa}/**
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
 */Y.prototype.simpleListen=function(n,e){this.sendRequest("q",{p:n},e)};Y.prototype.echo=function(n,e){this.sendRequest("echo",{d:n},e)};Ta();export{Aa as a,La as b,Pa as c,Ga as d,Oa as e,Ua as f,Wa as g,Va as h,ba as i,Ma as l,Da as o,ka as p,Fa as q,Ra as r,ua as s,xa as u};
