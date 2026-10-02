const Cr=()=>{};var ni={};/**
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
 */const mi={NODE_ADMIN:!1,SDK_VERSION:"${JSCORE_VERSION}"};/**
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
 */const Dr=function(n,i){if(!n)throw Or(i)},Or=function(n){return new Error("Firebase Database ("+mi.SDK_VERSION+") INTERNAL ASSERT FAILED: "+n)};/**
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
 */const yi=function(n){const i=[];let s=0;for(let a=0;a<n.length;a++){let c=n.charCodeAt(a);c<128?i[s++]=c:c<2048?(i[s++]=c>>6|192,i[s++]=c&63|128):(c&64512)===55296&&a+1<n.length&&(n.charCodeAt(a+1)&64512)===56320?(c=65536+((c&1023)<<10)+(n.charCodeAt(++a)&1023),i[s++]=c>>18|240,i[s++]=c>>12&63|128,i[s++]=c>>6&63|128,i[s++]=c&63|128):(i[s++]=c>>12|224,i[s++]=c>>6&63|128,i[s++]=c&63|128)}return i},Rr=function(n){const i=[];let s=0,a=0;for(;s<n.length;){const c=n[s++];if(c<128)i[a++]=String.fromCharCode(c);else if(c>191&&c<224){const w=n[s++];i[a++]=String.fromCharCode((c&31)<<6|w&63)}else if(c>239&&c<365){const w=n[s++],m=n[s++],S=n[s++],_=((c&7)<<18|(w&63)<<12|(m&63)<<6|S&63)-65536;i[a++]=String.fromCharCode(55296+(_>>10)),i[a++]=String.fromCharCode(56320+(_&1023))}else{const w=n[s++],m=n[s++];i[a++]=String.fromCharCode((c&15)<<12|(w&63)<<6|m&63)}}return i.join("")},vi={byteToCharMap_:null,charToByteMap_:null,byteToCharMapWebSafe_:null,charToByteMapWebSafe_:null,ENCODED_VALS_BASE:"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789",get ENCODED_VALS(){return this.ENCODED_VALS_BASE+"+/="},get ENCODED_VALS_WEBSAFE(){return this.ENCODED_VALS_BASE+"-_."},HAS_NATIVE_SUPPORT:typeof atob=="function",encodeByteArray(n,i){if(!Array.isArray(n))throw Error("encodeByteArray takes an array as a parameter");this.init_();const s=i?this.byteToCharMapWebSafe_:this.byteToCharMap_,a=[];for(let c=0;c<n.length;c+=3){const w=n[c],m=c+1<n.length,S=m?n[c+1]:0,_=c+2<n.length,E=_?n[c+2]:0,P=w>>2,I=(w&3)<<4|S>>4;let j=(S&15)<<2|E>>6,U=E&63;_||(U=64,m||(j=64)),a.push(s[P],s[I],s[j],s[U])}return a.join("")},encodeString(n,i){return this.HAS_NATIVE_SUPPORT&&!i?btoa(n):this.encodeByteArray(yi(n),i)},decodeString(n,i){return this.HAS_NATIVE_SUPPORT&&!i?atob(n):Rr(this.decodeStringToByteArray(n,i))},decodeStringToByteArray(n,i){this.init_();const s=i?this.charToByteMapWebSafe_:this.charToByteMap_,a=[];for(let c=0;c<n.length;){const w=s[n.charAt(c++)],S=c<n.length?s[n.charAt(c)]:0;++c;const E=c<n.length?s[n.charAt(c)]:64;++c;const I=c<n.length?s[n.charAt(c)]:64;if(++c,w==null||S==null||E==null||I==null)throw new kr;const j=w<<2|S>>4;if(a.push(j),E!==64){const U=S<<4&240|E>>2;if(a.push(U),I!==64){const L=E<<6&192|I;a.push(L)}}}return a},init_(){if(!this.byteToCharMap_){this.byteToCharMap_={},this.charToByteMap_={},this.byteToCharMapWebSafe_={},this.charToByteMapWebSafe_={};for(let n=0;n<this.ENCODED_VALS.length;n++)this.byteToCharMap_[n]=this.ENCODED_VALS.charAt(n),this.charToByteMap_[this.byteToCharMap_[n]]=n,this.byteToCharMapWebSafe_[n]=this.ENCODED_VALS_WEBSAFE.charAt(n),this.charToByteMapWebSafe_[this.byteToCharMapWebSafe_[n]]=n,n>=this.ENCODED_VALS_BASE.length&&(this.charToByteMap_[this.ENCODED_VALS_WEBSAFE.charAt(n)]=n,this.charToByteMapWebSafe_[this.ENCODED_VALS.charAt(n)]=n)}}};class kr extends Error{constructor(){super(...arguments),this.name="DecodeBase64StringError"}}const Pr=function(n){const i=yi(n);return vi.encodeByteArray(i,!0)},re=function(n){return Pr(n).replace(/\./g,"")},Fe=function(n){try{return vi.decodeString(n,!0)}catch(i){console.error("base64Decode failed: ",i)}return null};/**
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
 */function Qo(n){return wi(void 0,n)}function wi(n,i){if(!(i instanceof Object))return i;switch(i.constructor){case Date:const s=i;return new Date(s.getTime());case Object:n===void 0&&(n={});break;case Array:n=[];break;default:return i}for(const s in i)!i.hasOwnProperty(s)||!Mr(s)||(n[s]=wi(n[s],i[s]));return n}function Mr(n){return n!=="__proto__"}/**
 * @license
 * Copyright 2022 Google LLC
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
 */function Nr(){if(typeof self<"u")return self;if(typeof window<"u")return window;if(typeof global<"u")return global;throw new Error("Unable to locate global object.")}/**
 * @license
 * Copyright 2022 Google LLC
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
 */const jr=()=>Nr().__FIREBASE_DEFAULTS__,Br=()=>{if(typeof process>"u"||typeof ni>"u")return;const n=ni.__FIREBASE_DEFAULTS__;if(n)return JSON.parse(n)},xr=()=>{if(typeof document>"u")return;let n;try{n=document.cookie.match(/__FIREBASE_DEFAULTS__=([^;]+)/)}catch{return}const i=n&&Fe(n[1]);return i&&JSON.parse(i)},ae=()=>{try{return Cr()||jr()||Br()||xr()}catch(n){console.info(`Unable to get __FIREBASE_DEFAULTS__ due to: ${n}`);return}},Lr=n=>{var i,s;return(s=(i=ae())==null?void 0:i.emulatorHosts)==null?void 0:s[n]},ta=n=>{const i=Lr(n);if(!i)return;const s=i.lastIndexOf(":");if(s<=0||s+1===i.length)throw new Error(`Invalid host ${i} with no separate hostname and port!`);const a=parseInt(i.substring(s+1),10);return i[0]==="["?[i.substring(1,s-1),a]:[i.substring(0,s),a]},bi=()=>{var n;return(n=ae())==null?void 0:n.config},ea=n=>{var i;return(i=ae())==null?void 0:i[`_${n}`]};/**
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
 */class Hr{constructor(){this.reject=()=>{},this.resolve=()=>{},this.promise=new Promise((i,s)=>{this.resolve=i,this.reject=s})}wrapCallback(i){return(s,a)=>{s?this.reject(s):this.resolve(a),typeof i=="function"&&(this.promise.catch(()=>{}),i.length===1?i(s):i(s,a))}}}/**
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
 */function na(n,i){if(n.uid)throw new Error('The "uid" field is no longer supported by mockUserToken. Please use "sub" instead for Firebase Auth User ID.');const s={alg:"none",type:"JWT"},a=i||"demo-project",c=n.iat||0,w=n.sub||n.user_id;if(!w)throw new Error("mockUserToken must contain 'sub' or 'user_id' field!");const m={iss:`https://securetoken.google.com/${a}`,aud:a,iat:c,exp:c+3600,auth_time:c,sub:w,user_id:w,firebase:{sign_in_provider:"custom",identities:{}},...n};return[re(JSON.stringify(s)),re(JSON.stringify(m)),""].join(".")}/**
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
 */function Ei(){return typeof navigator<"u"&&typeof navigator.userAgent=="string"?navigator.userAgent:""}function ia(){return typeof window<"u"&&!!(window.cordova||window.phonegap||window.PhoneGap)&&/ios|iphone|ipod|ipad|android|blackberry|iemobile/i.test(Ei())}function Si(){var i;const n=(i=ae())==null?void 0:i.forceEnvironment;if(n==="node")return!0;if(n==="browser")return!1;try{return Object.prototype.toString.call(global.process)==="[object process]"}catch{return!1}}function ra(){return typeof navigator<"u"&&navigator.userAgent==="Cloudflare-Workers"}function sa(){const n=typeof chrome=="object"?chrome.runtime:typeof browser=="object"?browser.runtime:void 0;return typeof n=="object"&&n.id!==void 0}function oa(){return typeof navigator=="object"&&navigator.product==="ReactNative"}function aa(){const n=Ei();return n.indexOf("MSIE ")>=0||n.indexOf("Trident/")>=0}function ha(){return mi.NODE_ADMIN===!0}function ca(){return!Si()&&!!navigator.userAgent&&navigator.userAgent.includes("Safari")&&!navigator.userAgent.includes("Chrome")}function la(){return!Si()&&!!navigator.userAgent&&(navigator.userAgent.includes("Safari")||navigator.userAgent.includes("WebKit"))&&!navigator.userAgent.includes("Chrome")}function Fr(){try{return typeof indexedDB=="object"}catch{return!1}}function $r(){return new Promise((n,i)=>{try{let s=!0;const a="validate-browser-context-for-indexeddb-analytics-module",c=self.indexedDB.open(a);c.onsuccess=()=>{c.result.close(),s||self.indexedDB.deleteDatabase(a),n(!0)},c.onupgradeneeded=()=>{s=!1},c.onerror=()=>{var w;i(((w=c.error)==null?void 0:w.message)||"")}}catch(s){i(s)}})}function ua(){return!(typeof navigator>"u"||!navigator.cookieEnabled)}/**
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
 */const Vr="FirebaseError";class St extends Error{constructor(i,s,a){super(s),this.code=i,this.customData=a,this.name=Vr,Object.setPrototypeOf(this,St.prototype),Error.captureStackTrace&&Error.captureStackTrace(this,Xe.prototype.create)}}class Xe{constructor(i,s,a){this.service=i,this.serviceName=s,this.errors=a}create(i,...s){const a=s[0]||{},c=`${this.service}/${i}`,w=this.errors[i],m=w?Ur(w,a):"Error",S=`${this.serviceName}: ${m} (${c}).`;return new St(c,S,a)}}function Ur(n,i){try{let s=0,a="";for(;s<n.length;){const c=n.indexOf("{$",s);if(c===-1){a+=n.substring(s);break}const w=n.indexOf("}",c+2);if(w===-1){a+=n.substring(s);break}const m=n.substring(c+2,w),S=i[m];a+=n.substring(s,c)+(S!=null?String(S):`<${m}?>`),s=w+1}return a}catch{return n}}/**
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
 */function ii(n){return JSON.parse(n)}function fa(n){return JSON.stringify(n)}/**
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
 */const Ii=function(n){let i={},s={},a={},c="";try{const w=n.split(".");i=ii(Fe(w[0])||""),s=ii(Fe(w[1])||""),c=w[2],a=s.d||{},delete s.d}catch{}return{header:i,claims:s,data:a,signature:c}},pa=function(n){const i=Ii(n),s=i.claims;return!!s&&typeof s=="object"&&s.hasOwnProperty("iat")},ga=function(n){const i=Ii(n).claims;return typeof i=="object"&&i.admin===!0};/**
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
 */function da(n,i){return Object.prototype.hasOwnProperty.call(n,i)}function ma(n,i){if(Object.prototype.hasOwnProperty.call(n,i))return n[i]}function ya(n){for(const i in n)if(Object.prototype.hasOwnProperty.call(n,i))return!1;return!0}function va(n,i,s){const a={};for(const c in n)Object.prototype.hasOwnProperty.call(n,c)&&(a[c]=i.call(s,n[c],c,n));return a}function $e(n,i){if(n===i)return!0;const s=Object.keys(n),a=Object.keys(i);for(const c of s){if(!a.includes(c))return!1;const w=n[c],m=i[c];if(ri(w)&&ri(m)){if(!$e(w,m))return!1}else if(w!==m)return!1}for(const c of a)if(!s.includes(c))return!1;return!0}function ri(n){return n!==null&&typeof n=="object"}/**
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
 */function wa(n){const i=[];for(const[s,a]of Object.entries(n))Array.isArray(a)?a.forEach(c=>{i.push(encodeURIComponent(s)+"="+encodeURIComponent(c))}):i.push(encodeURIComponent(s)+"="+encodeURIComponent(a));return i.length?"&"+i.join("&"):""}function ba(n){const i={};return n.replace(/^\?/,"").split("&").forEach(a=>{if(a){const[c,w]=a.split("=");i[decodeURIComponent(c)]=decodeURIComponent(w)}}),i}function Ea(n){const i=n.indexOf("?");if(!i)return"";const s=n.indexOf("#",i);return n.substring(i,s>0?s:void 0)}/**
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
 */class Sa{constructor(){this.chain_=[],this.buf_=[],this.W_=[],this.pad_=[],this.inbuf_=0,this.total_=0,this.blockSize=512/8,this.pad_[0]=128;for(let i=1;i<this.blockSize;++i)this.pad_[i]=0;this.reset()}reset(){this.chain_[0]=1732584193,this.chain_[1]=4023233417,this.chain_[2]=2562383102,this.chain_[3]=271733878,this.chain_[4]=3285377520,this.inbuf_=0,this.total_=0}compress_(i,s){s||(s=0);const a=this.W_;if(typeof i=="string")for(let I=0;I<16;I++)a[I]=i.charCodeAt(s)<<24|i.charCodeAt(s+1)<<16|i.charCodeAt(s+2)<<8|i.charCodeAt(s+3),s+=4;else for(let I=0;I<16;I++)a[I]=i[s]<<24|i[s+1]<<16|i[s+2]<<8|i[s+3],s+=4;for(let I=16;I<80;I++){const j=a[I-3]^a[I-8]^a[I-14]^a[I-16];a[I]=(j<<1|j>>>31)&4294967295}let c=this.chain_[0],w=this.chain_[1],m=this.chain_[2],S=this.chain_[3],_=this.chain_[4],E,P;for(let I=0;I<80;I++){I<40?I<20?(E=S^w&(m^S),P=1518500249):(E=w^m^S,P=1859775393):I<60?(E=w&m|S&(w|m),P=2400959708):(E=w^m^S,P=3395469782);const j=(c<<5|c>>>27)+E+_+P+a[I]&4294967295;_=S,S=m,m=(w<<30|w>>>2)&4294967295,w=c,c=j}this.chain_[0]=this.chain_[0]+c&4294967295,this.chain_[1]=this.chain_[1]+w&4294967295,this.chain_[2]=this.chain_[2]+m&4294967295,this.chain_[3]=this.chain_[3]+S&4294967295,this.chain_[4]=this.chain_[4]+_&4294967295}update(i,s){if(i==null)return;s===void 0&&(s=i.length);const a=s-this.blockSize;let c=0;const w=this.buf_;let m=this.inbuf_;for(;c<s;){if(m===0)for(;c<=a;)this.compress_(i,c),c+=this.blockSize;if(typeof i=="string"){for(;c<s;)if(w[m]=i.charCodeAt(c),++m,++c,m===this.blockSize){this.compress_(w),m=0;break}}else for(;c<s;)if(w[m]=i[c],++m,++c,m===this.blockSize){this.compress_(w),m=0;break}}this.inbuf_=m,this.total_+=s}digest(){const i=[];let s=this.total_*8;this.inbuf_<56?this.update(this.pad_,56-this.inbuf_):this.update(this.pad_,this.blockSize-(this.inbuf_-56));for(let c=this.blockSize-1;c>=56;c--)this.buf_[c]=s&255,s/=256;this.compress_(this.buf_);let a=0;for(let c=0;c<5;c++)for(let w=24;w>=0;w-=8)i[a]=this.chain_[c]>>w&255,++a;return i}}function Ia(n,i){const s=new zr(n,i);return s.subscribe.bind(s)}class zr{constructor(i,s){this.observers=[],this.unsubscribes=[],this.observerCount=0,this.task=Promise.resolve(),this.finalized=!1,this.onNoObservers=s,this.task.then(()=>{i(this)}).catch(a=>{this.error(a)})}next(i){this.forEachObserver(s=>{s.next(i)})}error(i){this.forEachObserver(s=>{s.error(i)}),this.close(i)}complete(){this.forEachObserver(i=>{i.complete()}),this.close()}subscribe(i,s,a){let c;if(i===void 0&&s===void 0&&a===void 0)throw new Error("Missing Observer.");Wr(i,["next","error","complete"])?c=i:c={next:i,error:s,complete:a},c.next===void 0&&(c.next=Me),c.error===void 0&&(c.error=Me),c.complete===void 0&&(c.complete=Me);const w=this.unsubscribeOne.bind(this,this.observers.length);return this.finalized&&this.task.then(()=>{try{this.finalError?c.error(this.finalError):c.complete()}catch{}}),this.observers.push(c),w}unsubscribeOne(i){this.observers===void 0||this.observers[i]===void 0||(delete this.observers[i],this.observerCount-=1,this.observerCount===0&&this.onNoObservers!==void 0&&this.onNoObservers(this))}forEachObserver(i){if(!this.finalized)for(let s=0;s<this.observers.length;s++)this.sendOne(s,i)}sendOne(i,s){this.task.then(()=>{if(this.observers!==void 0&&this.observers[i]!==void 0)try{s(this.observers[i])}catch(a){typeof console<"u"&&console.error&&console.error(a)}})}close(i){this.finalized||(this.finalized=!0,i!==void 0&&(this.finalError=i),this.task.then(()=>{this.observers=void 0,this.onNoObservers=void 0}))}}function Wr(n,i){if(typeof n!="object"||n===null)return!1;for(const s of i)if(s in n&&typeof n[s]=="function")return!0;return!1}function Me(){}function _a(n,i){return`${n} failed: ${i} argument `}/**
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
 */const Aa=function(n){const i=[];let s=0;for(let a=0;a<n.length;a++){let c=n.charCodeAt(a);if(c>=55296&&c<=56319){const w=c-55296;a++,Dr(a<n.length,"Surrogate pair missing trail surrogate.");const m=n.charCodeAt(a)-56320;c=65536+(w<<10)+m}c<128?i[s++]=c:c<2048?(i[s++]=c>>6|192,i[s++]=c&63|128):c<65536?(i[s++]=c>>12|224,i[s++]=c>>6&63|128,i[s++]=c&63|128):(i[s++]=c>>18|240,i[s++]=c>>12&63|128,i[s++]=c>>6&63|128,i[s++]=c&63|128)}return i},Ta=function(n){let i=0;for(let s=0;s<n.length;s++){const a=n.charCodeAt(s);a<128?i++:a<2048?i+=2:a>=55296&&a<=56319?(i+=4,s++):i+=3}return i};/**
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
 */function Ca(n){return n&&n._delegate?n._delegate:n}/**
 * @license
 * Copyright 2025 Google LLC
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
 */function Da(n){try{return(n.startsWith("http://")||n.startsWith("https://")?new URL(n).hostname:n).endsWith(".cloudworkstations.dev")}catch{return!1}}async function Oa(n){return(await fetch(n,{credentials:"include"})).ok}class bt{constructor(i,s,a){this.name=i,this.instanceFactory=s,this.type=a,this.multipleInstances=!1,this.serviceProps={},this.instantiationMode="LAZY",this.onInstanceCreated=null}setInstantiationMode(i){return this.instantiationMode=i,this}setMultipleInstances(i){return this.multipleInstances=i,this}setServiceProps(i){return this.serviceProps=i,this}setInstanceCreatedCallback(i){return this.onInstanceCreated=i,this}}/**
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
 */const ct="[DEFAULT]";/**
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
 */class qr{constructor(i,s){this.name=i,this.container=s,this.component=null,this.instances=new Map,this.instancesDeferred=new Map,this.instancesOptions=new Map,this.onInitCallbacks=new Map}get(i){const s=this.normalizeInstanceIdentifier(i);if(!this.instancesDeferred.has(s)){const a=new Hr;if(this.instancesDeferred.set(s,a),this.isInitialized(s)||this.shouldAutoInitialize())try{const c=this.getOrInitializeService({instanceIdentifier:s});c&&a.resolve(c)}catch{}}return this.instancesDeferred.get(s).promise}getImmediate(i){const s=this.normalizeInstanceIdentifier(i==null?void 0:i.identifier),a=(i==null?void 0:i.optional)??!1;if(this.isInitialized(s)||this.shouldAutoInitialize())try{return this.getOrInitializeService({instanceIdentifier:s})}catch(c){if(a)return null;throw c}else{if(a)return null;throw Error(`Service ${this.name} is not available`)}}getComponent(){return this.component}setComponent(i){if(i.name!==this.name)throw Error(`Mismatching Component ${i.name} for Provider ${this.name}.`);if(this.component)throw Error(`Component for ${this.name} has already been provided`);if(this.component=i,!!this.shouldAutoInitialize()){if(Xr(i))try{this.getOrInitializeService({instanceIdentifier:ct})}catch{}for(const[s,a]of this.instancesDeferred.entries()){const c=this.normalizeInstanceIdentifier(s);try{const w=this.getOrInitializeService({instanceIdentifier:c});a.resolve(w)}catch{}}}}clearInstance(i=ct){this.instancesDeferred.delete(i),this.instancesOptions.delete(i),this.instances.delete(i)}async delete(){const i=Array.from(this.instances.values());await Promise.all([...i.filter(s=>"INTERNAL"in s).map(s=>s.INTERNAL.delete()),...i.filter(s=>"_delete"in s).map(s=>s._delete())])}isComponentSet(){return this.component!=null}isInitialized(i=ct){return this.instances.has(i)}getOptions(i=ct){return this.instancesOptions.get(i)||{}}initialize(i={}){const{options:s={}}=i,a=this.normalizeInstanceIdentifier(i.instanceIdentifier);if(this.isInitialized(a))throw Error(`${this.name}(${a}) has already been initialized`);if(!this.isComponentSet())throw Error(`Component ${this.name} has not been registered yet`);const c=this.getOrInitializeService({instanceIdentifier:a,options:s});for(const[w,m]of this.instancesDeferred.entries()){const S=this.normalizeInstanceIdentifier(w);a===S&&m.resolve(c)}return c}onInit(i,s){const a=this.normalizeInstanceIdentifier(s),c=this.onInitCallbacks.get(a)??new Set;c.add(i),this.onInitCallbacks.set(a,c);const w=this.instances.get(a);return w&&i(w,a),()=>{c.delete(i)}}invokeOnInitCallbacks(i,s){const a=this.onInitCallbacks.get(s);if(a)for(const c of a)try{c(i,s)}catch{}}getOrInitializeService({instanceIdentifier:i,options:s={}}){let a=this.instances.get(i);if(!a&&this.component&&(a=this.component.instanceFactory(this.container,{instanceIdentifier:Gr(i),options:s}),this.instances.set(i,a),this.instancesOptions.set(i,s),this.invokeOnInitCallbacks(a,i),this.component.onInstanceCreated))try{this.component.onInstanceCreated(this.container,i,a)}catch{}return a||null}normalizeInstanceIdentifier(i=ct){return this.component?this.component.multipleInstances?i:ct:i}shouldAutoInitialize(){return!!this.component&&this.component.instantiationMode!=="EXPLICIT"}}function Gr(n){return n===ct?void 0:n}function Xr(n){return n.instantiationMode==="EAGER"}/**
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
 */class Kr{constructor(i){this.name=i,this.providers=new Map}addComponent(i){const s=this.getProvider(i.name);if(s.isComponentSet())throw new Error(`Component ${i.name} has already been registered with ${this.name}`);s.setComponent(i)}addOrOverwriteComponent(i){this.getProvider(i.name).isComponentSet()&&this.providers.delete(i.name),this.addComponent(i)}getProvider(i){if(this.providers.has(i))return this.providers.get(i);const s=new qr(i,this);return this.providers.set(i,s),s}getProviders(){return Array.from(this.providers.values())}}/**
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
 */var D;(function(n){n[n.DEBUG=0]="DEBUG",n[n.VERBOSE=1]="VERBOSE",n[n.INFO=2]="INFO",n[n.WARN=3]="WARN",n[n.ERROR=4]="ERROR",n[n.SILENT=5]="SILENT"})(D||(D={}));const Jr={debug:D.DEBUG,verbose:D.VERBOSE,info:D.INFO,warn:D.WARN,error:D.ERROR,silent:D.SILENT},Yr=D.INFO,Zr={[D.DEBUG]:"log",[D.VERBOSE]:"log",[D.INFO]:"info",[D.WARN]:"warn",[D.ERROR]:"error"},Qr=(n,i,...s)=>{if(i<n.logLevel)return;const a=new Date().toISOString(),c=Zr[i];if(c)console[c](`[${a}]  ${n.name}:`,...s);else throw new Error(`Attempted to log a message with an invalid logType (value: ${i})`)};class ts{constructor(i){this.name=i,this._logLevel=Yr,this._logHandler=Qr,this._userLogHandler=null}get logLevel(){return this._logLevel}set logLevel(i){if(!(i in D))throw new TypeError(`Invalid value "${i}" assigned to \`logLevel\``);this._logLevel=i}setLogLevel(i){this._logLevel=typeof i=="string"?Jr[i]:i}get logHandler(){return this._logHandler}set logHandler(i){if(typeof i!="function")throw new TypeError("Value assigned to `logHandler` must be a function");this._logHandler=i}get userLogHandler(){return this._userLogHandler}set userLogHandler(i){this._userLogHandler=i}debug(...i){this._userLogHandler&&this._userLogHandler(this,D.DEBUG,...i),this._logHandler(this,D.DEBUG,...i)}log(...i){this._userLogHandler&&this._userLogHandler(this,D.VERBOSE,...i),this._logHandler(this,D.VERBOSE,...i)}info(...i){this._userLogHandler&&this._userLogHandler(this,D.INFO,...i),this._logHandler(this,D.INFO,...i)}warn(...i){this._userLogHandler&&this._userLogHandler(this,D.WARN,...i),this._logHandler(this,D.WARN,...i)}error(...i){this._userLogHandler&&this._userLogHandler(this,D.ERROR,...i),this._logHandler(this,D.ERROR,...i)}}const es=(n,i)=>i.some(s=>n instanceof s);let si,oi;function ns(){return si||(si=[IDBDatabase,IDBObjectStore,IDBIndex,IDBCursor,IDBTransaction])}function is(){return oi||(oi=[IDBCursor.prototype.advance,IDBCursor.prototype.continue,IDBCursor.prototype.continuePrimaryKey])}const _i=new WeakMap,Ve=new WeakMap,Ai=new WeakMap,Ne=new WeakMap,Ke=new WeakMap;function rs(n){const i=new Promise((s,a)=>{const c=()=>{n.removeEventListener("success",w),n.removeEventListener("error",m)},w=()=>{s(G(n.result)),c()},m=()=>{a(n.error),c()};n.addEventListener("success",w),n.addEventListener("error",m)});return i.then(s=>{s instanceof IDBCursor&&_i.set(s,n)}).catch(()=>{}),Ke.set(i,n),i}function ss(n){if(Ve.has(n))return;const i=new Promise((s,a)=>{const c=()=>{n.removeEventListener("complete",w),n.removeEventListener("error",m),n.removeEventListener("abort",m)},w=()=>{s(),c()},m=()=>{a(n.error||new DOMException("AbortError","AbortError")),c()};n.addEventListener("complete",w),n.addEventListener("error",m),n.addEventListener("abort",m)});Ve.set(n,i)}let Ue={get(n,i,s){if(n instanceof IDBTransaction){if(i==="done")return Ve.get(n);if(i==="objectStoreNames")return n.objectStoreNames||Ai.get(n);if(i==="store")return s.objectStoreNames[1]?void 0:s.objectStore(s.objectStoreNames[0])}return G(n[i])},set(n,i,s){return n[i]=s,!0},has(n,i){return n instanceof IDBTransaction&&(i==="done"||i==="store")?!0:i in n}};function os(n){Ue=n(Ue)}function as(n){return n===IDBDatabase.prototype.transaction&&!("objectStoreNames"in IDBTransaction.prototype)?function(i,...s){const a=n.call(je(this),i,...s);return Ai.set(a,i.sort?i.sort():[i]),G(a)}:is().includes(n)?function(...i){return n.apply(je(this),i),G(_i.get(this))}:function(...i){return G(n.apply(je(this),i))}}function hs(n){return typeof n=="function"?as(n):(n instanceof IDBTransaction&&ss(n),es(n,ns())?new Proxy(n,Ue):n)}function G(n){if(n instanceof IDBRequest)return rs(n);if(Ne.has(n))return Ne.get(n);const i=hs(n);return i!==n&&(Ne.set(n,i),Ke.set(i,n)),i}const je=n=>Ke.get(n);function Ti(n,i,{blocked:s,upgrade:a,blocking:c,terminated:w}={}){const m=indexedDB.open(n,i),S=G(m);return a&&m.addEventListener("upgradeneeded",_=>{a(G(m.result),_.oldVersion,_.newVersion,G(m.transaction),_)}),s&&m.addEventListener("blocked",_=>s(_.oldVersion,_.newVersion,_)),S.then(_=>{w&&_.addEventListener("close",()=>w()),c&&_.addEventListener("versionchange",E=>c(E.oldVersion,E.newVersion,E))}).catch(()=>{}),S}function Ra(n,{blocked:i}={}){const s=indexedDB.deleteDatabase(n);return i&&s.addEventListener("blocked",a=>i(a.oldVersion,a)),G(s).then(()=>{})}const cs=["get","getKey","getAll","getAllKeys","count"],ls=["put","add","delete","clear"],Be=new Map;function ai(n,i){if(!(n instanceof IDBDatabase&&!(i in n)&&typeof i=="string"))return;if(Be.get(i))return Be.get(i);const s=i.replace(/FromIndex$/,""),a=i!==s,c=ls.includes(s);if(!(s in(a?IDBIndex:IDBObjectStore).prototype)||!(c||cs.includes(s)))return;const w=async function(m,...S){const _=this.transaction(m,c?"readwrite":"readonly");let E=_.store;return a&&(E=E.index(S.shift())),(await Promise.all([E[s](...S),c&&_.done]))[0]};return Be.set(i,w),w}os(n=>({...n,get:(i,s,a)=>ai(i,s)||n.get(i,s,a),has:(i,s)=>!!ai(i,s)||n.has(i,s)}));/**
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
 */class us{constructor(i){this.container=i}getPlatformInfoString(){return this.container.getProviders().map(s=>{if(fs(s)){const a=s.getImmediate();return`${a.library}/${a.version}`}else return null}).filter(s=>s).join(" ")}}function fs(n){const i=n.getComponent();return(i==null?void 0:i.type)==="VERSION"}const ze="@firebase/app",hi="0.16.2";/**
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
 */const X=new ts("@firebase/app"),ps="@firebase/app-compat",gs="@firebase/analytics-compat",ds="@firebase/analytics",ms="@firebase/app-check-compat",ys="@firebase/app-check",vs="@firebase/auth",ws="@firebase/auth-compat",bs="@firebase/database",Es="@firebase/data-connect",Ss="@firebase/database-compat",Is="@firebase/functions",_s="@firebase/functions-compat",As="@firebase/installations",Ts="@firebase/installations-compat",Cs="@firebase/messaging",Ds="@firebase/messaging-compat",Os="@firebase/performance",Rs="@firebase/performance-compat",ks="@firebase/remote-config",Ps="@firebase/remote-config-compat",Ms="@firebase/storage",Ns="@firebase/storage-compat",js="@firebase/firestore",Bs="@firebase/ai",xs="@firebase/firestore-compat",Ls="firebase",Hs="12.19.0";/**
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
 */const We="[DEFAULT]",Fs={[ze]:"fire-core",[ps]:"fire-core-compat",[ds]:"fire-analytics",[gs]:"fire-analytics-compat",[ys]:"fire-app-check",[ms]:"fire-app-check-compat",[vs]:"fire-auth",[ws]:"fire-auth-compat",[bs]:"fire-rtdb",[Es]:"fire-data-connect",[Ss]:"fire-rtdb-compat",[Is]:"fire-fn",[_s]:"fire-fn-compat",[As]:"fire-iid",[Ts]:"fire-iid-compat",[Cs]:"fire-fcm",[Ds]:"fire-fcm-compat",[Os]:"fire-perf",[Rs]:"fire-perf-compat",[ks]:"fire-rc",[Ps]:"fire-rc-compat",[Ms]:"fire-gcs",[Ns]:"fire-gcs-compat",[js]:"fire-fst",[xs]:"fire-fst-compat",[Bs]:"fire-vertex","fire-js":"fire-js",[Ls]:"fire-js-all"};/**
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
 */const se=new Map,$s=new Map,qe=new Map;function ci(n,i){try{n.container.addComponent(i)}catch(s){X.debug(`Component ${i.name} failed to register with FirebaseApp ${n.name}`,s)}}function Ft(n){const i=n.name;if(qe.has(i))return X.debug(`There were multiple attempts to register component ${i}.`),!1;qe.set(i,n);for(const s of se.values())ci(s,n);for(const s of $s.values())ci(s,n);return!0}function Ci(n,i){const s=n.container.getProvider("heartbeat").getImmediate({optional:!0});return s&&s.triggerHeartbeat(),n.container.getProvider(i)}function ka(n){return n==null?!1:n.settings!==void 0}/**
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
 */const Vs={"no-app":"No Firebase App '{$appName}' has been created - call initializeApp() first","bad-app-name":"Illegal App name: '{$appName}'","duplicate-app":"Firebase App named '{$appName}' already exists with different {$mismatchedParam}. Existing: '{$oldValue}'. New: '{$newValue}'.","app-deleted":"Firebase App named '{$appName}' already deleted","server-app-deleted":"Firebase Server App has been deleted","no-options":"Need to provide options, when not being deployed to hosting via source.","invalid-app-argument":"firebase.{$appName}() takes either no argument or a Firebase App instance.","invalid-log-argument":"First argument to `onLog` must be null or a function.","idb-open":"Error thrown when opening IndexedDB. Original error: {$originalErrorMessage}.","idb-get":"Error thrown when reading from IndexedDB. Original error: {$originalErrorMessage}.","idb-set":"Error thrown when writing to IndexedDB. Original error: {$originalErrorMessage}.","idb-delete":"Error thrown when deleting from IndexedDB. Original error: {$originalErrorMessage}.","finalization-registry-not-supported":"FirebaseServerApp deleteOnDeref field defined but the JS runtime does not support FinalizationRegistry.","invalid-server-app-environment":"FirebaseServerApp is not for use in browser environments."},q=new Xe("app","Firebase",Vs);/**
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
 */class Us{constructor(i,s,a){this._isDeleted=!1,this._options={...i},this._config={...s},this._name=s.name,this._automaticDataCollectionEnabled=s.automaticDataCollectionEnabled,this._container=a,this.container.addComponent(new bt("app",()=>this,"PUBLIC"))}get automaticDataCollectionEnabled(){return this.checkDestroyed(),this._automaticDataCollectionEnabled}set automaticDataCollectionEnabled(i){this.checkDestroyed(),this._automaticDataCollectionEnabled=i}get name(){return this.checkDestroyed(),this._name}get options(){return this.checkDestroyed(),this._options}get config(){return this.checkDestroyed(),this._config}get container(){return this._container}get isDeleted(){return this._isDeleted}set isDeleted(i){this._isDeleted=i}checkDestroyed(){if(this.isDeleted)throw q.create("app-deleted",{appName:this._name})}}/**
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
 */const Pa=Hs;function zs(n,i={}){let s=n;typeof i!="object"&&(i={name:i});const a={name:We,automaticDataCollectionEnabled:!0,...i},c=a.name;if(typeof c!="string"||!c)throw q.create("bad-app-name",{appName:String(c)});if(s||(s=bi()),!s)throw q.create("no-options");const w=se.get(c);if(w)if($e(s,w.options)){if($e(a,w.config))return w;throw q.create("duplicate-app",{appName:c,mismatchedParam:"config",oldValue:JSON.stringify(w.config),newValue:JSON.stringify(a)})}else throw q.create("duplicate-app",{appName:c,mismatchedParam:"options",oldValue:JSON.stringify(w.options),newValue:JSON.stringify(s)});const m=new Kr(c);for(const _ of qe.values())m.addComponent(_);const S=new Us(s,a,m);return se.set(c,S),S}function Ma(n=We){const i=se.get(n);if(!i&&n===We&&bi())return zs();if(!i)throw q.create("no-app",{appName:n});return i}function wt(n,i,s){let a=Fs[n]??n;s&&(a+=`-${s}`);const c=a.match(/\s|\//),w=i.match(/\s|\//);if(c||w){const m=[`Unable to register library "${a}" with version "${i}":`];c&&m.push(`library name "${a}" contains illegal characters (whitespace or "/")`),c&&w&&m.push("and"),w&&m.push(`version name "${i}" contains illegal characters (whitespace or "/")`),X.warn(m.join(" "));return}Ft(new bt(`${a}-version`,()=>({library:a,version:i}),"VERSION"))}/**
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
 */const Ws="firebase-heartbeat-database",qs=1,$t="firebase-heartbeat-store";let xe=null;function Di(){return xe||(xe=Ti(Ws,qs,{upgrade:(n,i)=>{switch(i){case 0:try{n.createObjectStore($t)}catch(s){console.warn(s)}}}}).catch(n=>{throw q.create("idb-open",{originalErrorMessage:n.message})})),xe}async function Gs(n){try{const s=(await Di()).transaction($t),a=await s.objectStore($t).get(Oi(n));return await s.done,a}catch(i){if(i instanceof St)X.warn(i.message);else{const s=q.create("idb-get",{originalErrorMessage:i==null?void 0:i.message});X.warn(s.message)}}}async function li(n,i){try{const a=(await Di()).transaction($t,"readwrite");await a.objectStore($t).put(i,Oi(n)),await a.done}catch(s){if(s instanceof St)X.warn(s.message);else{const a=q.create("idb-set",{originalErrorMessage:s==null?void 0:s.message});X.warn(a.message)}}}function Oi(n){return`${n.name}!${n.options.appId}`}/**
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
 */const Xs=1024,Ks=30;class Js{constructor(i){this.container=i,this._heartbeatsCache=null;const s=this.container.getProvider("app").getImmediate();this._storage=new Zs(s),this._heartbeatsCachePromise=this._storage.read().then(a=>(this._heartbeatsCache=a,a))}async triggerHeartbeat(){var i,s;try{const c=this.container.getProvider("platform-logger").getImmediate().getPlatformInfoString(),w=ui();if(((i=this._heartbeatsCache)==null?void 0:i.heartbeats)==null&&(this._heartbeatsCache=await this._heartbeatsCachePromise,((s=this._heartbeatsCache)==null?void 0:s.heartbeats)==null)||this._heartbeatsCache.lastSentHeartbeatDate===w||this._heartbeatsCache.heartbeats.some(m=>m.date===w))return;if(this._heartbeatsCache.heartbeats.push({date:w,agent:c}),this._heartbeatsCache.heartbeats.length>Ks){const m=Qs(this._heartbeatsCache.heartbeats);this._heartbeatsCache.heartbeats.splice(m,1)}return this._storage.overwrite(this._heartbeatsCache)}catch(a){X.warn(a)}}async getHeartbeatsHeader(){var i;try{if(this._heartbeatsCache===null&&await this._heartbeatsCachePromise,((i=this._heartbeatsCache)==null?void 0:i.heartbeats)==null||this._heartbeatsCache.heartbeats.length===0)return"";const s=ui(),{heartbeatsToSend:a,unsentEntries:c}=Ys(this._heartbeatsCache.heartbeats),w=re(JSON.stringify({version:2,heartbeats:a}));return this._heartbeatsCache.lastSentHeartbeatDate=s,c.length>0?(this._heartbeatsCache.heartbeats=c,await this._storage.overwrite(this._heartbeatsCache)):(this._heartbeatsCache.heartbeats=[],this._storage.overwrite(this._heartbeatsCache)),w}catch(s){return X.warn(s),""}}}function ui(){return new Date().toISOString().substring(0,10)}function Ys(n,i=Xs){const s=[];let a=n.slice();for(const c of n){const w=s.find(m=>m.agent===c.agent);if(w){if(w.dates.push(c.date),fi(s)>i){w.dates.pop();break}}else if(s.push({agent:c.agent,dates:[c.date]}),fi(s)>i){s.pop();break}a=a.slice(1)}return{heartbeatsToSend:s,unsentEntries:a}}class Zs{constructor(i){this.app=i,this._canUseIndexedDBPromise=this.runIndexedDBEnvironmentCheck()}async runIndexedDBEnvironmentCheck(){return Fr()?$r().then(()=>!0).catch(()=>!1):!1}async read(){if(await this._canUseIndexedDBPromise){const s=await Gs(this.app);return s!=null&&s.heartbeats?s:{heartbeats:[]}}else return{heartbeats:[]}}async overwrite(i){if(await this._canUseIndexedDBPromise){const a=await this.read();return li(this.app,{lastSentHeartbeatDate:i.lastSentHeartbeatDate??a.lastSentHeartbeatDate,heartbeats:i.heartbeats})}else return}async add(i){if(await this._canUseIndexedDBPromise){const a=await this.read();return li(this.app,{lastSentHeartbeatDate:i.lastSentHeartbeatDate??a.lastSentHeartbeatDate,heartbeats:[...a.heartbeats,...i.heartbeats]})}else return}}function fi(n){return re(JSON.stringify({version:2,heartbeats:n})).length}function Qs(n){if(n.length===0)return-1;let i=0,s=n[0].date;for(let a=1;a<n.length;a++)n[a].date<s&&(s=n[a].date,i=a);return i}/**
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
 */function to(n){Ft(new bt("platform-logger",i=>new us(i),"PRIVATE")),Ft(new bt("heartbeat",i=>new Js(i),"PRIVATE")),wt(ze,hi,n),wt(ze,hi,"esm2020"),wt("fire-js","")}/**
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
 */to("");var pi=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var eo,no;(function(){var n;/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/function i(p,h){function u(){}u.prototype=h.prototype,p.F=h.prototype,p.prototype=new u,p.prototype.constructor=p,p.D=function(g,f,y){for(var l=Array(arguments.length-2),F=2;F<arguments.length;F++)l[F-2]=arguments[F];return h.prototype[f].apply(g,l)}}function s(){this.blockSize=-1}function a(){this.blockSize=-1,this.blockSize=64,this.g=Array(4),this.C=Array(this.blockSize),this.o=this.h=0,this.u()}i(a,s),a.prototype.u=function(){this.g[0]=1732584193,this.g[1]=4023233417,this.g[2]=2562383102,this.g[3]=271733878,this.o=this.h=0};function c(p,h,u){u||(u=0);const g=Array(16);if(typeof h=="string")for(var f=0;f<16;++f)g[f]=h.charCodeAt(u++)|h.charCodeAt(u++)<<8|h.charCodeAt(u++)<<16|h.charCodeAt(u++)<<24;else for(f=0;f<16;++f)g[f]=h[u++]|h[u++]<<8|h[u++]<<16|h[u++]<<24;h=p.g[0],u=p.g[1],f=p.g[2];let y=p.g[3],l;l=h+(y^u&(f^y))+g[0]+3614090360&4294967295,h=u+(l<<7&4294967295|l>>>25),l=y+(f^h&(u^f))+g[1]+3905402710&4294967295,y=h+(l<<12&4294967295|l>>>20),l=f+(u^y&(h^u))+g[2]+606105819&4294967295,f=y+(l<<17&4294967295|l>>>15),l=u+(h^f&(y^h))+g[3]+3250441966&4294967295,u=f+(l<<22&4294967295|l>>>10),l=h+(y^u&(f^y))+g[4]+4118548399&4294967295,h=u+(l<<7&4294967295|l>>>25),l=y+(f^h&(u^f))+g[5]+1200080426&4294967295,y=h+(l<<12&4294967295|l>>>20),l=f+(u^y&(h^u))+g[6]+2821735955&4294967295,f=y+(l<<17&4294967295|l>>>15),l=u+(h^f&(y^h))+g[7]+4249261313&4294967295,u=f+(l<<22&4294967295|l>>>10),l=h+(y^u&(f^y))+g[8]+1770035416&4294967295,h=u+(l<<7&4294967295|l>>>25),l=y+(f^h&(u^f))+g[9]+2336552879&4294967295,y=h+(l<<12&4294967295|l>>>20),l=f+(u^y&(h^u))+g[10]+4294925233&4294967295,f=y+(l<<17&4294967295|l>>>15),l=u+(h^f&(y^h))+g[11]+2304563134&4294967295,u=f+(l<<22&4294967295|l>>>10),l=h+(y^u&(f^y))+g[12]+1804603682&4294967295,h=u+(l<<7&4294967295|l>>>25),l=y+(f^h&(u^f))+g[13]+4254626195&4294967295,y=h+(l<<12&4294967295|l>>>20),l=f+(u^y&(h^u))+g[14]+2792965006&4294967295,f=y+(l<<17&4294967295|l>>>15),l=u+(h^f&(y^h))+g[15]+1236535329&4294967295,u=f+(l<<22&4294967295|l>>>10),l=h+(f^y&(u^f))+g[1]+4129170786&4294967295,h=u+(l<<5&4294967295|l>>>27),l=y+(u^f&(h^u))+g[6]+3225465664&4294967295,y=h+(l<<9&4294967295|l>>>23),l=f+(h^u&(y^h))+g[11]+643717713&4294967295,f=y+(l<<14&4294967295|l>>>18),l=u+(y^h&(f^y))+g[0]+3921069994&4294967295,u=f+(l<<20&4294967295|l>>>12),l=h+(f^y&(u^f))+g[5]+3593408605&4294967295,h=u+(l<<5&4294967295|l>>>27),l=y+(u^f&(h^u))+g[10]+38016083&4294967295,y=h+(l<<9&4294967295|l>>>23),l=f+(h^u&(y^h))+g[15]+3634488961&4294967295,f=y+(l<<14&4294967295|l>>>18),l=u+(y^h&(f^y))+g[4]+3889429448&4294967295,u=f+(l<<20&4294967295|l>>>12),l=h+(f^y&(u^f))+g[9]+568446438&4294967295,h=u+(l<<5&4294967295|l>>>27),l=y+(u^f&(h^u))+g[14]+3275163606&4294967295,y=h+(l<<9&4294967295|l>>>23),l=f+(h^u&(y^h))+g[3]+4107603335&4294967295,f=y+(l<<14&4294967295|l>>>18),l=u+(y^h&(f^y))+g[8]+1163531501&4294967295,u=f+(l<<20&4294967295|l>>>12),l=h+(f^y&(u^f))+g[13]+2850285829&4294967295,h=u+(l<<5&4294967295|l>>>27),l=y+(u^f&(h^u))+g[2]+4243563512&4294967295,y=h+(l<<9&4294967295|l>>>23),l=f+(h^u&(y^h))+g[7]+1735328473&4294967295,f=y+(l<<14&4294967295|l>>>18),l=u+(y^h&(f^y))+g[12]+2368359562&4294967295,u=f+(l<<20&4294967295|l>>>12),l=h+(u^f^y)+g[5]+4294588738&4294967295,h=u+(l<<4&4294967295|l>>>28),l=y+(h^u^f)+g[8]+2272392833&4294967295,y=h+(l<<11&4294967295|l>>>21),l=f+(y^h^u)+g[11]+1839030562&4294967295,f=y+(l<<16&4294967295|l>>>16),l=u+(f^y^h)+g[14]+4259657740&4294967295,u=f+(l<<23&4294967295|l>>>9),l=h+(u^f^y)+g[1]+2763975236&4294967295,h=u+(l<<4&4294967295|l>>>28),l=y+(h^u^f)+g[4]+1272893353&4294967295,y=h+(l<<11&4294967295|l>>>21),l=f+(y^h^u)+g[7]+4139469664&4294967295,f=y+(l<<16&4294967295|l>>>16),l=u+(f^y^h)+g[10]+3200236656&4294967295,u=f+(l<<23&4294967295|l>>>9),l=h+(u^f^y)+g[13]+681279174&4294967295,h=u+(l<<4&4294967295|l>>>28),l=y+(h^u^f)+g[0]+3936430074&4294967295,y=h+(l<<11&4294967295|l>>>21),l=f+(y^h^u)+g[3]+3572445317&4294967295,f=y+(l<<16&4294967295|l>>>16),l=u+(f^y^h)+g[6]+76029189&4294967295,u=f+(l<<23&4294967295|l>>>9),l=h+(u^f^y)+g[9]+3654602809&4294967295,h=u+(l<<4&4294967295|l>>>28),l=y+(h^u^f)+g[12]+3873151461&4294967295,y=h+(l<<11&4294967295|l>>>21),l=f+(y^h^u)+g[15]+530742520&4294967295,f=y+(l<<16&4294967295|l>>>16),l=u+(f^y^h)+g[2]+3299628645&4294967295,u=f+(l<<23&4294967295|l>>>9),l=h+(f^(u|~y))+g[0]+4096336452&4294967295,h=u+(l<<6&4294967295|l>>>26),l=y+(u^(h|~f))+g[7]+1126891415&4294967295,y=h+(l<<10&4294967295|l>>>22),l=f+(h^(y|~u))+g[14]+2878612391&4294967295,f=y+(l<<15&4294967295|l>>>17),l=u+(y^(f|~h))+g[5]+4237533241&4294967295,u=f+(l<<21&4294967295|l>>>11),l=h+(f^(u|~y))+g[12]+1700485571&4294967295,h=u+(l<<6&4294967295|l>>>26),l=y+(u^(h|~f))+g[3]+2399980690&4294967295,y=h+(l<<10&4294967295|l>>>22),l=f+(h^(y|~u))+g[10]+4293915773&4294967295,f=y+(l<<15&4294967295|l>>>17),l=u+(y^(f|~h))+g[1]+2240044497&4294967295,u=f+(l<<21&4294967295|l>>>11),l=h+(f^(u|~y))+g[8]+1873313359&4294967295,h=u+(l<<6&4294967295|l>>>26),l=y+(u^(h|~f))+g[15]+4264355552&4294967295,y=h+(l<<10&4294967295|l>>>22),l=f+(h^(y|~u))+g[6]+2734768916&4294967295,f=y+(l<<15&4294967295|l>>>17),l=u+(y^(f|~h))+g[13]+1309151649&4294967295,u=f+(l<<21&4294967295|l>>>11),l=h+(f^(u|~y))+g[4]+4149444226&4294967295,h=u+(l<<6&4294967295|l>>>26),l=y+(u^(h|~f))+g[11]+3174756917&4294967295,y=h+(l<<10&4294967295|l>>>22),l=f+(h^(y|~u))+g[2]+718787259&4294967295,f=y+(l<<15&4294967295|l>>>17),l=u+(y^(f|~h))+g[9]+3951481745&4294967295,p.g[0]=p.g[0]+h&4294967295,p.g[1]=p.g[1]+(f+(l<<21&4294967295|l>>>11))&4294967295,p.g[2]=p.g[2]+f&4294967295,p.g[3]=p.g[3]+y&4294967295}a.prototype.v=function(p,h){h===void 0&&(h=p.length);const u=h-this.blockSize,g=this.C;let f=this.h,y=0;for(;y<h;){if(f==0)for(;y<=u;)c(this,p,y),y+=this.blockSize;if(typeof p=="string"){for(;y<h;)if(g[f++]=p.charCodeAt(y++),f==this.blockSize){c(this,g),f=0;break}}else for(;y<h;)if(g[f++]=p[y++],f==this.blockSize){c(this,g),f=0;break}}this.h=f,this.o+=h},a.prototype.A=function(){var p=Array((this.h<56?this.blockSize:this.blockSize*2)-this.h);p[0]=128;for(var h=1;h<p.length-8;++h)p[h]=0;h=this.o*8;for(var u=p.length-8;u<p.length;++u)p[u]=h&255,h/=256;for(this.v(p),p=Array(16),h=0,u=0;u<4;++u)for(let g=0;g<32;g+=8)p[h++]=this.g[u]>>>g&255;return p};function w(p,h){var u=S;return Object.prototype.hasOwnProperty.call(u,p)?u[p]:u[p]=h(p)}function m(p,h){this.h=h;const u=[];let g=!0;for(let f=p.length-1;f>=0;f--){const y=p[f]|0;g&&y==h||(u[f]=y,g=!1)}this.g=u}var S={};function _(p){return-128<=p&&p<128?w(p,function(h){return new m([h|0],h<0?-1:0)}):new m([p|0],p<0?-1:0)}function E(p){if(isNaN(p)||!isFinite(p))return I;if(p<0)return R(E(-p));const h=[];let u=1;for(let g=0;p>=u;g++)h[g]=p/u|0,u*=4294967296;return new m(h,0)}function P(p,h){if(p.length==0)throw Error("number format error: empty string");if(h=h||10,h<2||36<h)throw Error("radix out of range: "+h);if(p.charAt(0)=="-")return R(P(p.substring(1),h));if(p.indexOf("-")>=0)throw Error('number format error: interior "-" character');const u=E(Math.pow(h,8));let g=I;for(let y=0;y<p.length;y+=8){var f=Math.min(8,p.length-y);const l=parseInt(p.substring(y,y+f),h);f<8?(f=E(Math.pow(h,f)),g=g.j(f).add(E(l))):(g=g.j(u),g=g.add(E(l)))}return g}var I=_(0),j=_(1),U=_(16777216);n=m.prototype,n.m=function(){if(H(this))return-R(this).m();let p=0,h=1;for(let u=0;u<this.g.length;u++){const g=this.i(u);p+=(g>=0?g:4294967296+g)*h,h*=4294967296}return p},n.toString=function(p){if(p=p||10,p<2||36<p)throw Error("radix out of range: "+p);if(L(this))return"0";if(H(this))return"-"+R(this).toString(p);const h=E(Math.pow(p,6));var u=this;let g="";for(;;){const f=dt(u,h).g;u=pt(u,f.j(h));let y=((u.g.length>0?u.g[0]:u.h)>>>0).toString(p);if(u=f,L(u))return y+g;for(;y.length<6;)y="0"+y;g=y+g}},n.i=function(p){return p<0?0:p<this.g.length?this.g[p]:this.h};function L(p){if(p.h!=0)return!1;for(let h=0;h<p.g.length;h++)if(p.g[h]!=0)return!1;return!0}function H(p){return p.h==-1}n.l=function(p){return p=pt(this,p),H(p)?-1:L(p)?0:1};function R(p){const h=p.g.length,u=[];for(let g=0;g<h;g++)u[g]=~p.g[g];return new m(u,~p.h).add(j)}n.abs=function(){return H(this)?R(this):this},n.add=function(p){const h=Math.max(this.g.length,p.g.length),u=[];let g=0;for(let f=0;f<=h;f++){let y=g+(this.i(f)&65535)+(p.i(f)&65535),l=(y>>>16)+(this.i(f)>>>16)+(p.i(f)>>>16);g=l>>>16,y&=65535,l&=65535,u[f]=l<<16|y}return new m(u,u[u.length-1]&-2147483648?-1:0)};function pt(p,h){return p.add(R(h))}n.j=function(p){if(L(this)||L(p))return I;if(H(this))return H(p)?R(this).j(R(p)):R(R(this).j(p));if(H(p))return R(this.j(R(p)));if(this.l(U)<0&&p.l(U)<0)return E(this.m()*p.m());const h=this.g.length+p.g.length,u=[];for(var g=0;g<2*h;g++)u[g]=0;for(g=0;g<this.g.length;g++)for(let f=0;f<p.g.length;f++){const y=this.i(g)>>>16,l=this.i(g)&65535,F=p.i(f)>>>16,it=p.i(f)&65535;u[2*g+2*f]+=l*it,gt(u,2*g+2*f),u[2*g+2*f+1]+=y*it,gt(u,2*g+2*f+1),u[2*g+2*f+1]+=l*F,gt(u,2*g+2*f+1),u[2*g+2*f+2]+=y*F,gt(u,2*g+2*f+2)}for(p=0;p<h;p++)u[p]=u[2*p+1]<<16|u[2*p];for(p=h;p<2*h;p++)u[p]=0;return new m(u,0)};function gt(p,h){for(;(p[h]&65535)!=p[h];)p[h+1]+=p[h]>>>16,p[h]&=65535,h++}function K(p,h){this.g=p,this.h=h}function dt(p,h){if(L(h))throw Error("division by zero");if(L(p))return new K(I,I);if(H(p))return h=dt(R(p),h),new K(R(h.g),R(h.h));if(H(h))return h=dt(p,R(h)),new K(R(h.g),h.h);if(p.g.length>30){if(H(p)||H(h))throw Error("slowDivide_ only works with positive integers.");for(var u=j,g=h;g.l(p)<=0;)u=J(u),g=J(g);var f=V(u,1),y=V(g,1);for(g=V(g,2),u=V(u,2);!L(g);){var l=y.add(g);l.l(p)<=0&&(f=f.add(u),y=l),g=V(g,1),u=V(u,1)}return h=pt(p,f.j(h)),new K(f,h)}for(f=I;p.l(h)>=0;){for(u=Math.max(1,Math.floor(p.m()/h.m())),g=Math.ceil(Math.log(u)/Math.LN2),g=g<=48?1:Math.pow(2,g-48),y=E(u),l=y.j(h);H(l)||l.l(p)>0;)u-=g,y=E(u),l=y.j(h);L(y)&&(y=j),f=f.add(y),p=pt(p,l)}return new K(f,p)}n.B=function(p){return dt(this,p).h},n.and=function(p){const h=Math.max(this.g.length,p.g.length),u=[];for(let g=0;g<h;g++)u[g]=this.i(g)&p.i(g);return new m(u,this.h&p.h)},n.or=function(p){const h=Math.max(this.g.length,p.g.length),u=[];for(let g=0;g<h;g++)u[g]=this.i(g)|p.i(g);return new m(u,this.h|p.h)},n.xor=function(p){const h=Math.max(this.g.length,p.g.length),u=[];for(let g=0;g<h;g++)u[g]=this.i(g)^p.i(g);return new m(u,this.h^p.h)};function J(p){const h=p.g.length+1,u=[];for(let g=0;g<h;g++)u[g]=p.i(g)<<1|p.i(g-1)>>>31;return new m(u,p.h)}function V(p,h){const u=h>>5;h%=32;const g=p.g.length-u,f=[];for(let y=0;y<g;y++)f[y]=h>0?p.i(y+u)>>>h|p.i(y+u+1)<<32-h:p.i(y+u);return new m(f,p.h)}a.prototype.digest=a.prototype.A,a.prototype.reset=a.prototype.u,a.prototype.update=a.prototype.v,no=a,m.prototype.add=m.prototype.add,m.prototype.multiply=m.prototype.j,m.prototype.modulo=m.prototype.B,m.prototype.compare=m.prototype.l,m.prototype.toNumber=m.prototype.m,m.prototype.toString=m.prototype.toString,m.prototype.getBits=m.prototype.i,m.fromNumber=E,m.fromString=P,eo=m}).apply(typeof pi<"u"?pi:typeof self<"u"?self:typeof window<"u"?window:{});var ie=typeof globalThis<"u"?globalThis:typeof window<"u"?window:typeof global<"u"?global:typeof self<"u"?self:{};/** @license
Copyright The Closure Library Authors.
SPDX-License-Identifier: Apache-2.0
*/var io,ro,so,oo,ao,ho,co,lo;(function(){var n,i=Object.defineProperty;function s(t){t=[typeof globalThis=="object"&&globalThis,t,typeof window=="object"&&window,typeof self=="object"&&self,typeof ie=="object"&&ie];for(var e=0;e<t.length;++e){var r=t[e];if(r&&r.Math==Math)return r}throw Error("Cannot find global object")}var a=s(this);function c(t,e){if(e)t:{var r=a;t=t.split(".");for(var o=0;o<t.length-1;o++){var d=t[o];if(!(d in r))break t;r=r[d]}t=t[t.length-1],o=r[t],e=e(o),e!=o&&e!=null&&i(r,t,{configurable:!0,writable:!0,value:e})}}c("Symbol.dispose",function(t){return t||Symbol("Symbol.dispose")}),c("Array.prototype.values",function(t){return t||function(){return this[Symbol.iterator]()}}),c("Object.entries",function(t){return t||function(e){var r=[],o;for(o in e)Object.prototype.hasOwnProperty.call(e,o)&&r.push([o,e[o]]);return r}});/** @license

 Copyright The Closure Library Authors.
 SPDX-License-Identifier: Apache-2.0
*/var w=w||{},m=this||self;function S(t){var e=typeof t;return e=="object"&&t!=null||e=="function"}function _(t,e,r){return t.call.apply(t.bind,arguments)}function E(t,e,r){return E=_,E.apply(null,arguments)}function P(t,e){var r=Array.prototype.slice.call(arguments,1);return function(){var o=r.slice();return o.push.apply(o,arguments),t.apply(this,o)}}function I(t,e){function r(){}r.prototype=e.prototype,t.Z=e.prototype,t.prototype=new r,t.prototype.constructor=t,t.Ob=function(o,d,v){for(var b=Array(arguments.length-2),A=2;A<arguments.length;A++)b[A-2]=arguments[A];return e.prototype[d].apply(o,b)}}var j=typeof AsyncContext<"u"&&typeof AsyncContext.Snapshot=="function"?t=>t&&AsyncContext.Snapshot.wrap(t):t=>t;function U(t){const e=t.length;if(e>0){const r=Array(e);for(let o=0;o<e;o++)r[o]=t[o];return r}return[]}function L(t,e){for(let o=1;o<arguments.length;o++){const d=arguments[o];var r=typeof d;if(r=r!="object"?r:d?Array.isArray(d)?"array":r:"null",r=="array"||r=="object"&&typeof d.length=="number"){r=t.length||0;const v=d.length||0;t.length=r+v;for(let b=0;b<v;b++)t[r+b]=d[b]}else t.push(d)}}class H{constructor(e,r){this.i=e,this.j=r,this.h=0,this.g=null}get(){let e;return this.h>0?(this.h--,e=this.g,this.g=e.next,e.next=null):e=this.i(),e}}function R(t){m.setTimeout(()=>{throw t},0)}function pt(){var t=p;let e=null;return t.g&&(e=t.g,t.g=t.g.next,t.g||(t.h=null),e.next=null),e}class gt{constructor(){this.h=this.g=null}add(e,r){const o=K.get();o.set(e,r),this.h?this.h.next=o:this.g=o,this.h=o}}var K=new H(()=>new dt,t=>t.reset());class dt{constructor(){this.next=this.g=this.h=null}set(e,r){this.h=e,this.g=r,this.next=null}reset(){this.next=this.g=this.h=null}}let J,V=!1,p=new gt,h=()=>{const t=Promise.resolve(void 0);J=()=>{t.then(u)}};function u(){for(var t;t=pt();){try{t.h.call(t.g)}catch(r){R(r)}var e=K;e.j(t),e.h<100&&(e.h++,t.next=e.g,e.g=t)}V=!1}function g(){this.u=this.u,this.C=this.C}g.prototype.u=!1,g.prototype.dispose=function(){this.u||(this.u=!0,this.N())},g.prototype[Symbol.dispose]=function(){this.dispose()},g.prototype.N=function(){if(this.C)for(;this.C.length;)this.C.shift()()};function f(t,e){this.type=t,this.g=this.target=e,this.defaultPrevented=!1}f.prototype.h=function(){this.defaultPrevented=!0};var y=function(){if(!m.addEventListener||!Object.defineProperty)return!1;var t=!1,e=Object.defineProperty({},"passive",{get:function(){t=!0}});try{const r=()=>{};m.addEventListener("test",r,e),m.removeEventListener("test",r,e)}catch{}return t}();function l(t){return/^[\s\xa0]*$/.test(t)}function F(t,e){f.call(this,t?t.type:""),this.relatedTarget=this.g=this.target=null,this.button=this.screenY=this.screenX=this.clientY=this.clientX=0,this.key="",this.metaKey=this.shiftKey=this.altKey=this.ctrlKey=!1,this.state=null,this.pointerId=0,this.pointerType="",this.i=null,t&&this.init(t,e)}I(F,f),F.prototype.init=function(t,e){const r=this.type=t.type,o=t.changedTouches&&t.changedTouches.length?t.changedTouches[0]:null;this.target=t.target||t.srcElement,this.g=e,e=t.relatedTarget,e||(r=="mouseover"?e=t.fromElement:r=="mouseout"&&(e=t.toElement)),this.relatedTarget=e,o?(this.clientX=o.clientX!==void 0?o.clientX:o.pageX,this.clientY=o.clientY!==void 0?o.clientY:o.pageY,this.screenX=o.screenX||0,this.screenY=o.screenY||0):(this.clientX=t.clientX!==void 0?t.clientX:t.pageX,this.clientY=t.clientY!==void 0?t.clientY:t.pageY,this.screenX=t.screenX||0,this.screenY=t.screenY||0),this.button=t.button,this.key=t.key||"",this.ctrlKey=t.ctrlKey,this.altKey=t.altKey,this.shiftKey=t.shiftKey,this.metaKey=t.metaKey,this.pointerId=t.pointerId||0,this.pointerType=t.pointerType,this.state=t.state,this.i=t,t.defaultPrevented&&F.Z.h.call(this)},F.prototype.h=function(){F.Z.h.call(this);const t=this.i;t.preventDefault?t.preventDefault():t.returnValue=!1};var it="closure_listenable_"+(Math.random()*1e6|0),Ki=0;function Ji(t,e,r,o,d){this.listener=t,this.proxy=null,this.src=e,this.type=r,this.capture=!!o,this.ha=d,this.key=++Ki,this.da=this.fa=!1}function Vt(t){t.da=!0,t.listener=null,t.proxy=null,t.src=null,t.ha=null}function Ut(t,e,r){for(const o in t)e.call(r,t[o],o,t)}function Yi(t,e){for(const r in t)e.call(void 0,t[r],r,t)}function tn(t){const e={};for(const r in t)e[r]=t[r];return e}const en="constructor hasOwnProperty isPrototypeOf propertyIsEnumerable toLocaleString toString valueOf".split(" ");function nn(t,e){let r,o;for(let d=1;d<arguments.length;d++){o=arguments[d];for(r in o)t[r]=o[r];for(let v=0;v<en.length;v++)r=en[v],Object.prototype.hasOwnProperty.call(o,r)&&(t[r]=o[r])}}function zt(t){this.src=t,this.g={},this.h=0}zt.prototype.add=function(t,e,r,o,d){const v=t.toString();t=this.g[v],t||(t=this.g[v]=[],this.h++);const b=le(t,e,o,d);return b>-1?(e=t[b],r||(e.fa=!1)):(e=new Ji(e,this.src,v,!!o,d),e.fa=r,t.push(e)),e};function ce(t,e){const r=e.type;if(r in t.g){var o=t.g[r],d=Array.prototype.indexOf.call(o,e,void 0),v;(v=d>=0)&&Array.prototype.splice.call(o,d,1),v&&(Vt(e),t.g[r].length==0&&(delete t.g[r],t.h--))}}function le(t,e,r,o){for(let d=0;d<t.length;++d){const v=t[d];if(!v.da&&v.listener==e&&v.capture==!!r&&v.ha==o)return d}return-1}var ue="closure_lm_"+(Math.random()*1e6|0),fe={};function rn(t,e,r,o,d){if(Array.isArray(e)){for(let v=0;v<e.length;v++)rn(t,e[v],r,o,d);return null}return r=an(r),t&&t[it]?t.J(e,r,S(o)?!!o.capture:!1,d):Zi(t,e,r,!1,o,d)}function Zi(t,e,r,o,d,v){if(!e)throw Error("Invalid event type");const b=S(d)?!!d.capture:!!d;let A=ge(t);if(A||(t[ue]=A=new zt(t)),r=A.add(e,r,o,b,v),r.proxy)return r;if(o=Qi(),r.proxy=o,o.src=t,o.listener=r,t.addEventListener)y||(d=b),d===void 0&&(d=!1),t.addEventListener(e.toString(),o,d);else if(t.attachEvent)t.attachEvent(on(e.toString()),o);else if(t.addListener&&t.removeListener)t.addListener(o);else throw Error("addEventListener and attachEvent are unavailable.");return r}function Qi(){function t(r){return e.call(t.src,t.listener,r)}const e=tr;return t}function sn(t,e,r,o,d){if(Array.isArray(e))for(var v=0;v<e.length;v++)sn(t,e[v],r,o,d);else o=S(o)?!!o.capture:!!o,r=an(r),t&&t[it]?(t=t.i,v=String(e).toString(),v in t.g&&(e=t.g[v],r=le(e,r,o,d),r>-1&&(Vt(e[r]),Array.prototype.splice.call(e,r,1),e.length==0&&(delete t.g[v],t.h--)))):t&&(t=ge(t))&&(e=t.g[e.toString()],t=-1,e&&(t=le(e,r,o,d)),(r=t>-1?e[t]:null)&&pe(r))}function pe(t){if(typeof t!="number"&&t&&!t.da){var e=t.src;if(e&&e[it])ce(e.i,t);else{var r=t.type,o=t.proxy;e.removeEventListener?e.removeEventListener(r,o,t.capture):e.detachEvent?e.detachEvent(on(r),o):e.addListener&&e.removeListener&&e.removeListener(o),(r=ge(e))?(ce(r,t),r.h==0&&(r.src=null,e[ue]=null)):Vt(t)}}}function on(t){return t in fe?fe[t]:fe[t]="on"+t}function tr(t,e){if(t.da)t=!0;else{e=new F(e,this);const r=t.listener,o=t.ha||t.src;t.fa&&pe(t),t=r.call(o,e)}return t}function ge(t){return t=t[ue],t instanceof zt?t:null}var de="__closure_events_fn_"+(Math.random()*1e9>>>0);function an(t){return typeof t=="function"?t:(t[de]||(t[de]=function(e){return t.handleEvent(e)}),t[de])}function N(){g.call(this),this.i=new zt(this),this.M=this,this.G=null}I(N,g),N.prototype[it]=!0,N.prototype.removeEventListener=function(t,e,r,o){sn(this,t,e,r,o)};function B(t,e){var r,o=t.G;if(o)for(r=[];o;o=o.G)r.push(o);if(t=t.M,o=e.type||e,typeof e=="string")e=new f(e,t);else if(e instanceof f)e.target=e.target||t;else{var d=e;e=new f(o,t),nn(e,d)}d=!0;let v,b;if(r)for(b=r.length-1;b>=0;b--)v=e.g=r[b],d=Wt(v,o,!0,e)&&d;if(v=e.g=t,d=Wt(v,o,!0,e)&&d,d=Wt(v,o,!1,e)&&d,r)for(b=0;b<r.length;b++)v=e.g=r[b],d=Wt(v,o,!1,e)&&d}N.prototype.N=function(){if(N.Z.N.call(this),this.i){var t=this.i;for(const e in t.g){const r=t.g[e];for(let o=0;o<r.length;o++)Vt(r[o]);delete t.g[e],t.h--}}this.G=null},N.prototype.J=function(t,e,r,o){return this.i.add(String(t),e,!1,r,o)},N.prototype.K=function(t,e,r,o){return this.i.add(String(t),e,!0,r,o)};function Wt(t,e,r,o){if(e=t.i.g[String(e)],!e)return!0;e=e.concat();let d=!0;for(let v=0;v<e.length;++v){const b=e[v];if(b&&!b.da&&b.capture==r){const A=b.listener,k=b.ha||b.src;b.fa&&ce(t.i,b),d=A.call(k,o)!==!1&&d}}return d&&!o.defaultPrevented}function er(t,e){if(typeof t!="function")if(t&&typeof t.handleEvent=="function")t=E(t.handleEvent,t);else throw Error("Invalid listener argument");return Number(e)>2147483647?-1:m.setTimeout(t,e||0)}function hn(t){t.g=er(()=>{t.g=null,t.i&&(t.i=!1,hn(t))},t.l);const e=t.h;t.h=null,t.m.apply(null,e)}class nr extends g{constructor(e,r){super(),this.m=e,this.l=r,this.h=null,this.i=!1,this.g=null}j(e){this.h=arguments,this.g?this.i=!0:hn(this)}N(){super.N(),this.g&&(m.clearTimeout(this.g),this.g=null,this.i=!1,this.h=null)}}function _t(t){g.call(this),this.h=t,this.g={}}I(_t,g);var cn=[];function ln(t){Ut(t.g,function(e,r){this.g.hasOwnProperty(r)&&pe(e)},t),t.g={}}_t.prototype.N=function(){_t.Z.N.call(this),ln(this)},_t.prototype.handleEvent=function(){throw Error("EventHandler.handleEvent not implemented")};var me=m.JSON.stringify,ir=m.JSON.parse,rr=class{stringify(t){return m.JSON.stringify(t,void 0)}parse(t){return m.JSON.parse(t,void 0)}};function un(){}function fn(){}var At={OPEN:"a",hb:"b",ERROR:"c",tb:"d"};function ye(){f.call(this,"d")}I(ye,f);function ve(){f.call(this,"c")}I(ve,f);var rt={},pn=null;function qt(){return pn=pn||new N}rt.Ia="serverreachability";function gn(t){f.call(this,rt.Ia,t)}I(gn,f);function Tt(t){const e=qt();B(e,new gn(e))}rt.STAT_EVENT="statevent";function dn(t,e){f.call(this,rt.STAT_EVENT,t),this.stat=e}I(dn,f);function x(t){const e=qt();B(e,new dn(e,t))}rt.Ja="timingevent";function mn(t,e){f.call(this,rt.Ja,t),this.size=e}I(mn,f);function Ct(t,e){if(typeof t!="function")throw Error("Fn must not be null and must be a function");return m.setTimeout(function(){t()},e)}function Dt(){this.g=!0}Dt.prototype.ua=function(){this.g=!1};function sr(t,e,r,o,d,v){t.info(function(){if(t.g)if(v){var b="",A=v.split("&");for(let T=0;T<A.length;T++){var k=A[T].split("=");if(k.length>1){const M=k[0];k=k[1];const W=M.split("_");b=W.length>=2&&W[1]=="type"?b+(M+"="+k+"&"):b+(M+"=redacted&")}}}else b=null;else b=v;return"XMLHTTP REQ ("+o+") [attempt "+d+"]: "+e+`
`+r+`
`+b})}function or(t,e,r,o,d,v,b){t.info(function(){return"XMLHTTP RESP ("+o+") [ attempt "+d+"]: "+e+`
`+r+`
`+v+" "+b})}function mt(t,e,r,o){t.info(function(){return"XMLHTTP TEXT ("+e+"): "+hr(t,r)+(o?" "+o:"")})}function ar(t,e){t.info(function(){return"TIMEOUT: "+e})}Dt.prototype.info=function(){};function hr(t,e){if(!t.g)return e;if(!e)return null;try{const v=JSON.parse(e);if(v){for(t=0;t<v.length;t++)if(Array.isArray(v[t])){var r=v[t];if(!(r.length<2)){var o=r[1];if(Array.isArray(o)&&!(o.length<1)){var d=o[0];if(d!="noop"&&d!="stop"&&d!="close")for(let b=1;b<o.length;b++)o[b]=""}}}}return me(v)}catch{return e}}var Gt={NO_ERROR:0,cb:1,qb:2,pb:3,kb:4,ob:5,rb:6,Ga:7,TIMEOUT:8,ub:9},yn={ib:"complete",Fb:"success",ERROR:"error",Ga:"abort",xb:"ready",yb:"readystatechange",TIMEOUT:"timeout",sb:"incrementaldata",wb:"progress",lb:"downloadprogress",Nb:"uploadprogress"},vn;function we(){}I(we,un),we.prototype.g=function(){return new XMLHttpRequest},vn=new we;function Ot(t){return encodeURIComponent(String(t))}function cr(t){var e=1;t=t.split(":");const r=[];for(;e>0&&t.length;)r.push(t.shift()),e--;return t.length&&r.push(t.join(":")),r}function Y(t,e,r,o){this.j=t,this.i=e,this.l=r,this.S=o||1,this.V=new _t(this),this.H=45e3,this.J=null,this.o=!1,this.u=this.B=this.A=this.M=this.F=this.T=this.D=null,this.G=[],this.g=null,this.C=0,this.m=this.v=null,this.X=-1,this.K=!1,this.P=0,this.O=null,this.W=this.L=this.U=this.R=!1,this.h=new wn}function wn(){this.i=null,this.g="",this.h=!1}var bn={},be={};function Ee(t,e,r){t.M=1,t.A=Kt(z(e)),t.u=r,t.R=!0,En(t,null)}function En(t,e){t.F=Date.now(),Xt(t),t.B=z(t.A);var r=t.B,o=t.S;Array.isArray(o)||(o=[String(o)]),Nn(r.i,"t",o),t.C=0,r=t.j.L,t.h=new wn,t.g=Zn(t.j,r?e:null,!t.u),t.P>0&&(t.O=new nr(E(t.Y,t,t.g),t.P)),e=t.V,r=t.g,o=t.ba;var d="readystatechange";Array.isArray(d)||(d&&(cn[0]=d.toString()),d=cn);for(let v=0;v<d.length;v++){const b=rn(r,d[v],o||e.handleEvent,!1,e.h||e);if(!b)break;e.g[b.key]=b}e=t.J?tn(t.J):{},t.u?(t.v||(t.v="POST"),e["Content-Type"]="application/x-www-form-urlencoded",t.g.ea(t.B,t.v,t.u,e)):(t.v="GET",t.g.ea(t.B,t.v,null,e)),Tt(),sr(t.i,t.v,t.B,t.l,t.S,t.u)}Y.prototype.ba=function(t){t=t.target;const e=this.O;e&&tt(t)==3?e.j():this.Y(t)},Y.prototype.Y=function(t){try{if(t==this.g)t:{const A=tt(this.g),k=this.g.ya(),T=this.g.ca();if(!(A<3)&&(A!=3||this.g&&(this.h.h||this.g.la()||$n(this.g)))){this.K||A!=4||k==7||(k==8||T<=0?Tt(3):Tt(2)),Se(this);var e=this.g.ca();this.X=e;var r=lr(this);if(this.o=e==200,or(this.i,this.v,this.B,this.l,this.S,A,e),this.o){if(this.U&&!this.L){e:{if(this.g){var o,d=this.g;if((o=d.g?d.g.getResponseHeader("X-HTTP-Initial-Response"):null)&&!l(o)){var v=o;break e}}v=null}if(t=v)mt(this.i,this.l,t,"Initial handshake response via X-HTTP-Initial-Response"),this.L=!0,Ie(this,t);else{this.o=!1,this.m=3,x(12),st(this),Rt(this);break t}}if(this.R){t=!0;let M;for(;!this.K&&this.C<r.length;)if(M=ur(this,r),M==be){A==4&&(this.m=4,x(14),t=!1),mt(this.i,this.l,null,"[Incomplete Response]");break}else if(M==bn){this.m=4,x(15),mt(this.i,this.l,r,"[Invalid Chunk]"),t=!1;break}else mt(this.i,this.l,M,null),Ie(this,M);if(Sn(this)&&this.C!=0&&(this.h.g=this.h.g.slice(this.C),this.C=0),A!=4||r.length!=0||this.h.h||(this.m=1,x(16),t=!1),this.o=this.o&&t,!t)mt(this.i,this.l,r,"[Invalid Chunked Response]"),st(this),Rt(this);else if(r.length>0&&!this.W){this.W=!0;var b=this.j;b.g==this&&b.aa&&!b.P&&(b.j.info("Great, no buffering proxy detected. Bytes received: "+r.length),ke(b),b.P=!0,x(11))}}else mt(this.i,this.l,r,null),Ie(this,r);A==4&&st(this),this.o&&!this.K&&(A==4?Xn(this.j,this):(this.o=!1,Xt(this)))}else Ar(this.g),e==400&&r.indexOf("Unknown SID")>0?(this.m=3,x(12)):(this.m=0,x(13)),st(this),Rt(this)}}}catch{}finally{}};function lr(t){if(!Sn(t))return t.g.la();const e=$n(t.g);if(e==="")return"";let r="";const o=e.length,d=tt(t.g)==4;if(!t.h.i){if(typeof TextDecoder>"u")return st(t),Rt(t),"";t.h.i=new m.TextDecoder}for(let v=0;v<o;v++)t.h.h=!0,r+=t.h.i.decode(e[v],{stream:!(d&&v==o-1)});return e.length=0,t.h.g+=r,t.C=0,t.h.g}function Sn(t){return t.g?t.v=="GET"&&t.M!=2&&t.j.Aa:!1}function ur(t,e){var r=t.C,o=e.indexOf(`
`,r);return o==-1?be:(r=Number(e.substring(r,o)),isNaN(r)?bn:(o+=1,o+r>e.length?be:(e=e.slice(o,o+r),t.C=o+r,e)))}Y.prototype.cancel=function(){this.K=!0,st(this)};function Xt(t){t.T=Date.now()+t.H,In(t,t.H)}function In(t,e){if(t.D!=null)throw Error("WatchDog timer not null");t.D=Ct(E(t.aa,t),e)}function Se(t){t.D&&(m.clearTimeout(t.D),t.D=null)}Y.prototype.aa=function(){this.D=null;const t=Date.now();t-this.T>=0?(ar(this.i,this.B),this.M!=2&&(Tt(),x(17)),st(this),this.m=2,Rt(this)):In(this,this.T-t)};function Rt(t){t.j.I==0||t.K||Xn(t.j,t)}function st(t){Se(t);var e=t.O;e&&typeof e.dispose=="function"&&e.dispose(),t.O=null,ln(t.V),t.g&&(e=t.g,t.g=null,e.abort(),e.dispose())}function Ie(t,e){try{var r=t.j;if(r.I!=0&&(r.g==t||_e(r.h,t))){if(!t.L&&_e(r.h,t)&&r.I==3){try{var o=r.Ba.g.parse(e)}catch{o=null}if(Array.isArray(o)&&o.length==3){var d=o;if(d[0]==0){t:if(!r.v){if(r.g)if(r.g.F+3e3<t.F)te(r),Zt(r);else break t;Re(r),x(18)}}else r.xa=d[1],0<r.xa-r.K&&d[2]<37500&&r.F&&r.A==0&&!r.C&&(r.C=Ct(E(r.Va,r),6e3));Tn(r.h)<=1&&r.ta&&(r.ta=void 0)}else at(r,11)}else if((t.L||r.g==t)&&te(r),!l(e))for(d=r.Ba.g.parse(e),e=0;e<d.length;e++){let T=d[e];const M=T[0];if(!(M<=r.K))if(r.K=M,T=T[1],r.I==2)if(T[0]=="c"){r.M=T[1],r.ba=T[2];const W=T[3];W!=null&&(r.ka=W,r.j.info("VER="+r.ka));const ht=T[4];ht!=null&&(r.za=ht,r.j.info("SVER="+r.za));const et=T[5];et!=null&&typeof et=="number"&&et>0&&(o=1.5*et,r.O=o,r.j.info("backChannelRequestTimeoutMs_="+o)),o=r;const nt=t.g;if(nt){const ne=nt.g?nt.g.getResponseHeader("X-Client-Wire-Protocol"):null;if(ne){var v=o.h;v.g||ne.indexOf("spdy")==-1&&ne.indexOf("quic")==-1&&ne.indexOf("h2")==-1||(v.j=v.l,v.g=new Set,v.h&&(Ae(v,v.h),v.h=null))}if(o.G){const Pe=nt.g?nt.g.getResponseHeader("X-HTTP-Session-Id"):null;Pe&&(o.wa=Pe,C(o.J,o.G,Pe))}}r.I=3,r.l&&r.l.ra(),r.aa&&(r.T=Date.now()-t.F,r.j.info("Handshake RTT: "+r.T+"ms")),o=r;var b=t;if(o.na=Yn(o,o.L?o.ba:null,o.W),b.L){Cn(o.h,b);var A=b,k=o.O;k&&(A.H=k),A.D&&(Se(A),Xt(A)),o.g=b}else qn(o);r.i.length>0&&Qt(r)}else T[0]!="stop"&&T[0]!="close"||at(r,7);else r.I==3&&(T[0]=="stop"||T[0]=="close"?T[0]=="stop"?at(r,7):Oe(r):T[0]!="noop"&&r.l&&r.l.qa(T),r.A=0)}}Tt(4)}catch{}}var fr=class{constructor(t,e){this.g=t,this.map=e}};function _n(t){this.l=t||10,m.PerformanceNavigationTiming?(t=m.performance.getEntriesByType("navigation"),t=t.length>0&&(t[0].nextHopProtocol=="hq"||t[0].nextHopProtocol=="h2")):t=!!(m.chrome&&m.chrome.loadTimes&&m.chrome.loadTimes()&&m.chrome.loadTimes().wasFetchedViaSpdy),this.j=t?this.l:1,this.g=null,this.j>1&&(this.g=new Set),this.h=null,this.i=[]}function An(t){return t.h?!0:t.g?t.g.size>=t.j:!1}function Tn(t){return t.h?1:t.g?t.g.size:0}function _e(t,e){return t.h?t.h==e:t.g?t.g.has(e):!1}function Ae(t,e){t.g?t.g.add(e):t.h=e}function Cn(t,e){t.h&&t.h==e?t.h=null:t.g&&t.g.has(e)&&t.g.delete(e)}_n.prototype.cancel=function(){if(this.i=Dn(this),this.h)this.h.cancel(),this.h=null;else if(this.g&&this.g.size!==0){for(const t of this.g.values())t.cancel();this.g.clear()}};function Dn(t){if(t.h!=null)return t.i.concat(t.h.G);if(t.g!=null&&t.g.size!==0){let e=t.i;for(const r of t.g.values())e=e.concat(r.G);return e}return U(t.i)}var On=RegExp("^(?:([^:/?#.]+):)?(?://(?:([^\\\\/?#]*)@)?([^\\\\/?#]*?)(?::([0-9]+))?(?=[\\\\/?#]|$))?([^?#]+)?(?:\\?([^#]*))?(?:#([\\s\\S]*))?$");function pr(t,e){if(t){t=t.split("&");for(let r=0;r<t.length;r++){const o=t[r].indexOf("=");let d,v=null;o>=0?(d=t[r].substring(0,o),v=t[r].substring(o+1)):d=t[r],e(d,v?decodeURIComponent(v.replace(/\+/g," ")):"")}}}function Z(t){this.g=this.o=this.j="",this.u=null,this.m=this.h="",this.l=!1;let e;t instanceof Z?(this.l=t.l,kt(this,t.j),this.o=t.o,this.g=t.g,Pt(this,t.u),this.h=t.h,Te(this,jn(t.i)),this.m=t.m):t&&(e=String(t).match(On))?(this.l=!1,kt(this,e[1]||"",!0),this.o=Mt(e[2]||""),this.g=Mt(e[3]||"",!0),Pt(this,e[4]),this.h=Mt(e[5]||"",!0),Te(this,e[6]||"",!0),this.m=Mt(e[7]||"")):(this.l=!1,this.i=new jt(null,this.l))}Z.prototype.toString=function(){const t=[];var e=this.j;e&&t.push(Nt(e,Rn,!0),":");var r=this.g;return(r||e=="file")&&(t.push("//"),(e=this.o)&&t.push(Nt(e,Rn,!0),"@"),t.push(Ot(r).replace(/%25([0-9a-fA-F]{2})/g,"%$1")),r=this.u,r!=null&&t.push(":",String(r))),(r=this.h)&&(this.g&&r.charAt(0)!="/"&&t.push("/"),t.push(Nt(r,r.charAt(0)=="/"?mr:dr,!0))),(r=this.i.toString())&&t.push("?",r),(r=this.m)&&t.push("#",Nt(r,vr)),t.join("")},Z.prototype.resolve=function(t){const e=z(this);let r=!!t.j;r?kt(e,t.j):r=!!t.o,r?e.o=t.o:r=!!t.g,r?e.g=t.g:r=t.u!=null;var o=t.h;if(r)Pt(e,t.u);else if(r=!!t.h){if(o.charAt(0)!="/")if(this.g&&!this.h)o="/"+o;else{var d=e.h.lastIndexOf("/");d!=-1&&(o=e.h.slice(0,d+1)+o)}if(d=o,d==".."||d==".")o="";else if(d.indexOf("./")!=-1||d.indexOf("/.")!=-1){o=d.lastIndexOf("/",0)==0,d=d.split("/");const v=[];for(let b=0;b<d.length;){const A=d[b++];A=="."?o&&b==d.length&&v.push(""):A==".."?((v.length>1||v.length==1&&v[0]!="")&&v.pop(),o&&b==d.length&&v.push("")):(v.push(A),o=!0)}o=v.join("/")}else o=d}return r?e.h=o:r=t.i.toString()!=="",r?Te(e,jn(t.i)):r=!!t.m,r&&(e.m=t.m),e};function z(t){return new Z(t)}function kt(t,e,r){t.j=r?Mt(e,!0):e,t.j&&(t.j=t.j.replace(/:$/,""))}function Pt(t,e){if(e){if(e=Number(e),isNaN(e)||e<0)throw Error("Bad port number "+e);t.u=e}else t.u=null}function Te(t,e,r){e instanceof jt?(t.i=e,wr(t.i,t.l)):(r||(e=Nt(e,yr)),t.i=new jt(e,t.l))}function C(t,e,r){t.i.set(e,r)}function Kt(t){return C(t,"zx",Math.floor(Math.random()*2147483648).toString(36)+Math.abs(Math.floor(Math.random()*2147483648)^Date.now()).toString(36)),t}function Mt(t,e){return t?e?decodeURI(t.replace(/%25/g,"%2525")):decodeURIComponent(t):""}function Nt(t,e,r){return typeof t=="string"?(t=encodeURI(t).replace(e,gr),r&&(t=t.replace(/%25([0-9a-fA-F]{2})/g,"%$1")),t):null}function gr(t){return t=t.charCodeAt(0),"%"+(t>>4&15).toString(16)+(t&15).toString(16)}var Rn=/[#\/\?@]/g,dr=/[#\?:]/g,mr=/[#\?]/g,yr=/[#\?@]/g,vr=/#/g;function jt(t,e){this.h=this.g=null,this.i=t||null,this.j=!!e}function ot(t){t.g||(t.g=new Map,t.h=0,t.i&&pr(t.i,function(e,r){t.add(decodeURIComponent(e.replace(/\+/g," ")),r)}))}n=jt.prototype,n.add=function(t,e){ot(this),this.i=null,t=yt(this,t);let r=this.g.get(t);return r||this.g.set(t,r=[]),r.push(e),this.h+=1,this};function kn(t,e){ot(t),e=yt(t,e),t.g.has(e)&&(t.i=null,t.h-=t.g.get(e).length,t.g.delete(e))}function Pn(t,e){return ot(t),e=yt(t,e),t.g.has(e)}n.forEach=function(t,e){ot(this),this.g.forEach(function(r,o){r.forEach(function(d){t.call(e,d,o,this)},this)},this)};function Mn(t,e){ot(t);let r=[];if(typeof e=="string")Pn(t,e)&&(r=r.concat(t.g.get(yt(t,e))));else for(t=Array.from(t.g.values()),e=0;e<t.length;e++)r=r.concat(t[e]);return r}n.set=function(t,e){return ot(this),this.i=null,t=yt(this,t),Pn(this,t)&&(this.h-=this.g.get(t).length),this.g.set(t,[e]),this.h+=1,this},n.get=function(t,e){return t?(t=Mn(this,t),t.length>0?String(t[0]):e):e};function Nn(t,e,r){kn(t,e),r.length>0&&(t.i=null,t.g.set(yt(t,e),U(r)),t.h+=r.length)}n.toString=function(){if(this.i)return this.i;if(!this.g)return"";const t=[],e=Array.from(this.g.keys());for(let o=0;o<e.length;o++){var r=e[o];const d=Ot(r);r=Mn(this,r);for(let v=0;v<r.length;v++){let b=d;r[v]!==""&&(b+="="+Ot(r[v])),t.push(b)}}return this.i=t.join("&")};function jn(t){const e=new jt;return e.i=t.i,t.g&&(e.g=new Map(t.g),e.h=t.h),e}function yt(t,e){return e=String(e),t.j&&(e=e.toLowerCase()),e}function wr(t,e){e&&!t.j&&(ot(t),t.i=null,t.g.forEach(function(r,o){const d=o.toLowerCase();o!=d&&(kn(this,o),Nn(this,d,r))},t)),t.j=e}function br(t,e){const r=new Dt;if(m.Image){const o=new Image;o.onload=P(Q,r,"TestLoadImage: loaded",!0,e,o),o.onerror=P(Q,r,"TestLoadImage: error",!1,e,o),o.onabort=P(Q,r,"TestLoadImage: abort",!1,e,o),o.ontimeout=P(Q,r,"TestLoadImage: timeout",!1,e,o),m.setTimeout(function(){o.ontimeout&&o.ontimeout()},1e4),o.src=t}else e(!1)}function Er(t,e){const r=new Dt,o=new AbortController,d=setTimeout(()=>{o.abort(),Q(r,"TestPingServer: timeout",!1,e)},1e4);fetch(t,{signal:o.signal}).then(v=>{clearTimeout(d),v.ok?Q(r,"TestPingServer: ok",!0,e):Q(r,"TestPingServer: server error",!1,e)}).catch(()=>{clearTimeout(d),Q(r,"TestPingServer: error",!1,e)})}function Q(t,e,r,o,d){try{d&&(d.onload=null,d.onerror=null,d.onabort=null,d.ontimeout=null),o(r)}catch{}}function Sr(){this.g=new rr}function Ce(t){this.i=t.Sb||null,this.h=t.ab||!1}I(Ce,un),Ce.prototype.g=function(){return new Jt(this.i,this.h)};function Jt(t,e){N.call(this),this.H=t,this.o=e,this.m=void 0,this.status=this.readyState=0,this.responseType=this.responseText=this.response=this.statusText="",this.onreadystatechange=null,this.A=new Headers,this.h=null,this.F="GET",this.D="",this.g=!1,this.B=this.j=this.l=null,this.v=new AbortController}I(Jt,N),n=Jt.prototype,n.open=function(t,e){if(this.readyState!=0)throw this.abort(),Error("Error reopening a connection");this.F=t,this.D=e,this.readyState=1,xt(this)},n.send=function(t){if(this.readyState!=1)throw this.abort(),Error("need to call open() first. ");if(this.v.signal.aborted)throw this.abort(),Error("Request was aborted.");this.g=!0;const e={headers:this.A,method:this.F,credentials:this.m,cache:void 0,signal:this.v.signal};t&&(e.body=t),(this.H||m).fetch(new Request(this.D,e)).then(this.Pa.bind(this),this.ga.bind(this))},n.abort=function(){this.response=this.responseText="",this.A=new Headers,this.status=0,this.v.abort(),this.j&&this.j.cancel("Request was aborted.").catch(()=>{}),this.readyState>=1&&this.g&&this.readyState!=4&&(this.g=!1,Bt(this)),this.readyState=0},n.Pa=function(t){if(this.g&&(this.l=t,this.h||(this.status=this.l.status,this.statusText=this.l.statusText,this.h=t.headers,this.readyState=2,xt(this)),this.g&&(this.readyState=3,xt(this),this.g)))if(this.responseType==="arraybuffer")t.arrayBuffer().then(this.Na.bind(this),this.ga.bind(this));else if(typeof m.ReadableStream<"u"&&"body"in t){if(this.j=t.body.getReader(),this.o){if(this.responseType)throw Error('responseType must be empty for "streamBinaryChunks" mode responses.');this.response=[]}else this.response=this.responseText="",this.B=new TextDecoder;Bn(this)}else t.text().then(this.Oa.bind(this),this.ga.bind(this))};function Bn(t){t.j.read().then(t.Ma.bind(t)).catch(t.ga.bind(t))}n.Ma=function(t){if(this.g){if(this.o&&t.value)this.response.push(t.value);else if(!this.o){var e=t.value?t.value:new Uint8Array(0);(e=this.B.decode(e,{stream:!t.done}))&&(this.response=this.responseText+=e)}t.done?Bt(this):xt(this),this.readyState==3&&Bn(this)}},n.Oa=function(t){this.g&&(this.response=this.responseText=t,Bt(this))},n.Na=function(t){this.g&&(this.response=t,Bt(this))},n.ga=function(){this.g&&Bt(this)};function Bt(t){t.readyState=4,t.l=null,t.j=null,t.B=null,xt(t)}n.setRequestHeader=function(t,e){this.A.append(t,e)},n.getResponseHeader=function(t){return this.h&&this.h.get(t.toLowerCase())||""},n.getAllResponseHeaders=function(){if(!this.h)return"";const t=[],e=this.h.entries();for(var r=e.next();!r.done;)r=r.value,t.push(r[0]+": "+r[1]),r=e.next();return t.join(`\r
`)};function xt(t){t.onreadystatechange&&t.onreadystatechange.call(t)}Object.defineProperty(Jt.prototype,"withCredentials",{get:function(){return this.m==="include"},set:function(t){this.m=t?"include":"same-origin"}});function xn(t){let e="";return Ut(t,function(r,o){e+=o,e+=":",e+=r,e+=`\r
`}),e}function De(t,e,r){t:{for(o in r){var o=!1;break t}o=!0}o||(r=xn(r),typeof t=="string"?r!=null&&Ot(r):C(t,e,r))}function O(t){N.call(this),this.headers=new Map,this.L=t||null,this.h=!1,this.g=null,this.D="",this.o=0,this.l="",this.j=this.B=this.v=this.A=!1,this.m=null,this.F="",this.H=!1}I(O,N);var Ir=/^https?$/i,_r=["POST","PUT"];n=O.prototype,n.Fa=function(t){this.H=t},n.ea=function(t,e,r,o){if(this.g)throw Error("[goog.net.XhrIo] Object is active with another request="+this.D+"; newUri="+t);e=e?e.toUpperCase():"GET",this.D=t,this.l="",this.o=0,this.A=!1,this.h=!0,this.g=this.L?this.L.g():vn.g(),this.g.onreadystatechange=j(E(this.Ca,this));try{this.B=!0,this.g.open(e,String(t),!0),this.B=!1}catch(v){Ln(this,v);return}if(t=r||"",r=new Map(this.headers),o)if(Object.getPrototypeOf(o)===Object.prototype)for(var d in o)r.set(d,o[d]);else if(typeof o.keys=="function"&&typeof o.get=="function")for(const v of o.keys())r.set(v,o.get(v));else throw Error("Unknown input type for opt_headers: "+String(o));o=Array.from(r.keys()).find(v=>v.toLowerCase()=="content-type"),d=m.FormData&&t instanceof m.FormData,!(Array.prototype.indexOf.call(_r,e,void 0)>=0)||o||d||r.set("Content-Type","application/x-www-form-urlencoded;charset=utf-8");for(const[v,b]of r)this.g.setRequestHeader(v,b);this.F&&(this.g.responseType=this.F),"withCredentials"in this.g&&this.g.withCredentials!==this.H&&(this.g.withCredentials=this.H);try{this.m&&(clearTimeout(this.m),this.m=null),this.v=!0,this.g.send(t),this.v=!1}catch(v){Ln(this,v)}};function Ln(t,e){t.h=!1,t.g&&(t.j=!0,t.g.abort(),t.j=!1),t.l=e,t.o=5,Hn(t),Yt(t)}function Hn(t){t.A||(t.A=!0,B(t,"complete"),B(t,"error"))}n.abort=function(t){this.g&&this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1,this.o=t||7,B(this,"complete"),B(this,"abort"),Yt(this))},n.N=function(){this.g&&(this.h&&(this.h=!1,this.j=!0,this.g.abort(),this.j=!1),Yt(this,!0)),O.Z.N.call(this)},n.Ca=function(){this.u||(this.B||this.v||this.j?Fn(this):this.Xa())},n.Xa=function(){Fn(this)};function Fn(t){if(t.h&&typeof w<"u"){if(t.v&&tt(t)==4)setTimeout(t.Ca.bind(t),0);else if(B(t,"readystatechange"),tt(t)==4){t.h=!1;try{const v=t.ca();t:switch(v){case 200:case 201:case 202:case 204:case 206:case 304:case 1223:var e=!0;break t;default:e=!1}var r;if(!(r=e)){var o;if(o=v===0){let b=String(t.D).match(On)[1]||null;!b&&m.self&&m.self.location&&(b=m.self.location.protocol.slice(0,-1)),o=!Ir.test(b?b.toLowerCase():"")}r=o}if(r)B(t,"complete"),B(t,"success");else{t.o=6;try{var d=tt(t)>2?t.g.statusText:""}catch{d=""}t.l=d+" ["+t.ca()+"]",Hn(t)}}finally{Yt(t)}}}}function Yt(t,e){if(t.g){t.m&&(clearTimeout(t.m),t.m=null);const r=t.g;t.g=null,e||B(t,"ready");try{r.onreadystatechange=null}catch{}}}n.isActive=function(){return!!this.g};function tt(t){return t.g?t.g.readyState:0}n.ca=function(){try{return tt(this)>2?this.g.status:-1}catch{return-1}},n.la=function(){try{return this.g?this.g.responseText:""}catch{return""}},n.La=function(t){if(this.g){var e=this.g.responseText;return t&&e.indexOf(t)==0&&(e=e.substring(t.length)),ir(e)}};function $n(t){try{if(!t.g)return null;if("response"in t.g)return t.g.response;switch(t.F){case"":case"text":return t.g.responseText;case"arraybuffer":if("mozResponseArrayBuffer"in t.g)return t.g.mozResponseArrayBuffer}return null}catch{return null}}function Ar(t){const e={};t=(t.g&&tt(t)>=2&&t.g.getAllResponseHeaders()||"").split(`\r
`);for(let o=0;o<t.length;o++){if(l(t[o]))continue;var r=cr(t[o]);const d=r[0];if(r=r[1],typeof r!="string")continue;r=r.trim();const v=e[d]||[];e[d]=v,v.push(r)}Yi(e,function(o){return o.join(", ")})}n.ya=function(){return this.o},n.Ha=function(){return typeof this.l=="string"?this.l:String(this.l)};function Lt(t,e,r){return r&&r.internalChannelParams&&r.internalChannelParams[t]||e}function Vn(t){this.za=0,this.i=[],this.j=new Dt,this.ba=this.na=this.J=this.W=this.g=this.wa=this.G=this.H=this.u=this.U=this.o=null,this.Ya=this.V=0,this.Sa=Lt("failFast",!1,t),this.F=this.C=this.v=this.m=this.l=null,this.X=!0,this.xa=this.K=-1,this.Y=this.A=this.D=0,this.Qa=Lt("baseRetryDelayMs",5e3,t),this.Za=Lt("retryDelaySeedMs",1e4,t),this.Ta=Lt("forwardChannelMaxRetries",2,t),this.va=Lt("forwardChannelRequestTimeoutMs",2e4,t),this.ma=t&&t.xmlHttpFactory||void 0,this.Ua=t&&t.Rb||void 0,this.Aa=t&&t.useFetchStreams||!1,this.O=void 0,this.L=t&&t.supportsCrossDomainXhr||!1,this.M="",this.h=new _n(t&&t.concurrentRequestLimit),this.Ba=new Sr,this.S=t&&t.fastHandshake||!1,this.R=t&&t.encodeInitMessageHeaders||!1,this.S&&this.R&&(this.R=!1),this.Ra=t&&t.Pb||!1,t&&t.ua&&this.j.ua(),t&&t.forceLongPolling&&(this.X=!1),this.aa=!this.S&&this.X&&t&&t.detectBufferingProxy||!1,this.ia=void 0,t&&t.longPollingTimeout&&t.longPollingTimeout>0&&(this.ia=t.longPollingTimeout),this.ta=void 0,this.T=0,this.P=!1,this.ja=this.B=null}n=Vn.prototype,n.ka=8,n.I=1,n.connect=function(t,e,r,o){x(0),this.W=t,this.H=e||{},r&&o!==void 0&&(this.H.OSID=r,this.H.OAID=o),this.F=this.X,this.J=Yn(this,null,this.W),Qt(this)};function Oe(t){if(Un(t),t.I==3){var e=t.V++,r=z(t.J);if(C(r,"SID",t.M),C(r,"RID",e),C(r,"TYPE","terminate"),Ht(t,r),e=new Y(t,t.j,e),e.M=2,e.A=Kt(z(r)),r=!1,m.navigator&&m.navigator.sendBeacon)try{r=m.navigator.sendBeacon(e.A.toString(),"")}catch{}!r&&m.Image&&(new Image().src=e.A,r=!0),r||(e.g=Zn(e.j,null),e.g.ea(e.A)),e.F=Date.now(),Xt(e)}Jn(t)}function Zt(t){t.g&&(ke(t),t.g.cancel(),t.g=null)}function Un(t){Zt(t),t.v&&(m.clearTimeout(t.v),t.v=null),te(t),t.h.cancel(),t.m&&(typeof t.m=="number"&&m.clearTimeout(t.m),t.m=null)}function Qt(t){if(!An(t.h)&&!t.m){t.m=!0;var e=t.Ea;J||h(),V||(J(),V=!0),p.add(e,t),t.D=0}}function Tr(t,e){return Tn(t.h)>=t.h.j-(t.m?1:0)?!1:t.m?(t.i=e.G.concat(t.i),!0):t.I==1||t.I==2||t.D>=(t.Sa?0:t.Ta)?!1:(t.m=Ct(E(t.Ea,t,e),Kn(t,t.D)),t.D++,!0)}n.Ea=function(t){if(this.m)if(this.m=null,this.I==1){if(!t){this.V=Math.floor(Math.random()*1e5),t=this.V++;const d=new Y(this,this.j,t);let v=this.o;if(this.U&&(v?(v=tn(v),nn(v,this.U)):v=this.U),this.u!==null||this.R||(d.J=v,v=null),this.S)t:{for(var e=0,r=0;r<this.i.length;r++){e:{var o=this.i[r];if("__data__"in o.map&&(o=o.map.__data__,typeof o=="string")){o=o.length;break e}o=void 0}if(o===void 0)break;if(e+=o,e>4096){e=r;break t}if(e===4096||r===this.i.length-1){e=r+1;break t}}e=1e3}else e=1e3;e=Wn(this,d,e),r=z(this.J),C(r,"RID",t),C(r,"CVER",22),this.G&&C(r,"X-HTTP-Session-Id",this.G),Ht(this,r),v&&(this.R?e="headers="+Ot(xn(v))+"&"+e:this.u&&De(r,this.u,v)),Ae(this.h,d),this.Ra&&C(r,"TYPE","init"),this.S?(C(r,"$req",e),C(r,"SID","null"),d.U=!0,Ee(d,r,null)):Ee(d,r,e),this.I=2}}else this.I==3&&(t?zn(this,t):this.i.length==0||An(this.h)||zn(this))};function zn(t,e){var r;e?r=e.l:r=t.V++;const o=z(t.J);C(o,"SID",t.M),C(o,"RID",r),C(o,"AID",t.K),Ht(t,o),t.u&&t.o&&De(o,t.u,t.o),r=new Y(t,t.j,r,t.D+1),t.u===null&&(r.J=t.o),e&&(t.i=e.G.concat(t.i)),e=Wn(t,r,1e3),r.H=Math.round(t.va*.5)+Math.round(t.va*.5*Math.random()),Ae(t.h,r),Ee(r,o,e)}function Ht(t,e){t.H&&Ut(t.H,function(r,o){C(e,o,r)}),t.l&&Ut({},function(r,o){C(e,o,r)})}function Wn(t,e,r){r=Math.min(t.i.length,r);const o=t.l?E(t.l.Ka,t.l,t):null;t:{var d=t.i;let A=-1;for(;;){const k=["count="+r];A==-1?r>0?(A=d[0].g,k.push("ofs="+A)):A=0:k.push("ofs="+A);let T=!0;for(let M=0;M<r;M++){var v=d[M].g;const W=d[M].map;if(v-=A,v<0)A=Math.max(0,d[M].g-100),T=!1;else try{v="req"+v+"_"||"";try{var b=W instanceof Map?W:Object.entries(W);for(const[ht,et]of b){let nt=et;S(et)&&(nt=me(et)),k.push(v+ht+"="+encodeURIComponent(nt))}}catch(ht){throw k.push(v+"type="+encodeURIComponent("_badmap")),ht}}catch{o&&o(W)}}if(T){b=k.join("&");break t}}b=void 0}return t=t.i.splice(0,r),e.G=t,b}function qn(t){if(!t.g&&!t.v){t.Y=1;var e=t.Da;J||h(),V||(J(),V=!0),p.add(e,t),t.A=0}}function Re(t){return t.g||t.v||t.A>=3?!1:(t.Y++,t.v=Ct(E(t.Da,t),Kn(t,t.A)),t.A++,!0)}n.Da=function(){if(this.v=null,Gn(this),this.aa&&!(this.P||this.g==null||this.T<=0)){var t=4*this.T;this.j.info("BP detection timer enabled: "+t),this.B=Ct(E(this.Wa,this),t)}},n.Wa=function(){this.B&&(this.B=null,this.j.info("BP detection timeout reached."),this.j.info("Buffering proxy detected and switch to long-polling!"),this.F=!1,this.P=!0,x(10),Zt(this),Gn(this))};function ke(t){t.B!=null&&(m.clearTimeout(t.B),t.B=null)}function Gn(t){t.g=new Y(t,t.j,"rpc",t.Y),t.u===null&&(t.g.J=t.o),t.g.P=0;var e=z(t.na);C(e,"RID","rpc"),C(e,"SID",t.M),C(e,"AID",t.K),C(e,"CI",t.F?"0":"1"),!t.F&&t.ia&&C(e,"TO",t.ia),C(e,"TYPE","xmlhttp"),Ht(t,e),t.u&&t.o&&De(e,t.u,t.o),t.O&&(t.g.H=t.O);var r=t.g;t=t.ba,r.M=1,r.A=Kt(z(e)),r.u=null,r.R=!0,En(r,t)}n.Va=function(){this.C!=null&&(this.C=null,Zt(this),Re(this),x(19))};function te(t){t.C!=null&&(m.clearTimeout(t.C),t.C=null)}function Xn(t,e){var r=null;if(t.g==e){te(t),ke(t),t.g=null;var o=2}else if(_e(t.h,e))r=e.G,Cn(t.h,e),o=1;else return;if(t.I!=0){if(e.o)if(o==1){r=e.u?e.u.length:0,e=Date.now()-e.F;var d=t.D;o=qt(),B(o,new mn(o,r)),Qt(t)}else qn(t);else if(d=e.m,d==3||d==0&&e.X>0||!(o==1&&Tr(t,e)||o==2&&Re(t)))switch(r&&r.length>0&&(e=t.h,e.i=e.i.concat(r)),d){case 1:at(t,5);break;case 4:at(t,10);break;case 3:at(t,6);break;default:at(t,2)}}}function Kn(t,e){let r=t.Qa+Math.floor(Math.random()*t.Za);return t.isActive()||(r*=2),r*e}function at(t,e){if(t.j.info("Error code "+e),e==2){var r=E(t.bb,t),o=t.Ua;const d=!o;o=new Z(o||"//www.google.com/images/cleardot.gif"),m.location&&m.location.protocol=="http"||kt(o,"https"),Kt(o),d?br(o.toString(),r):Er(o.toString(),r)}else x(2);t.I=0,t.l&&t.l.pa(e),Jn(t),Un(t)}n.bb=function(t){t?(this.j.info("Successfully pinged google.com"),x(2)):(this.j.info("Failed to ping google.com"),x(1))};function Jn(t){if(t.I=0,t.ja=[],t.l){const e=Dn(t.h);(e.length!=0||t.i.length!=0)&&(L(t.ja,e),L(t.ja,t.i),t.h.i.length=0,U(t.i),t.i.length=0),t.l.oa()}}function Yn(t,e,r){var o=r instanceof Z?z(r):new Z(r);if(o.g!="")e&&(o.g=e+"."+o.g),Pt(o,o.u);else{var d=m.location;o=d.protocol,e=e?e+"."+d.hostname:d.hostname,d=+d.port;const v=new Z(null);o&&kt(v,o),e&&(v.g=e),d&&Pt(v,d),r&&(v.h=r),o=v}return r=t.G,e=t.wa,r&&e&&C(o,r,e),C(o,"VER",t.ka),Ht(t,o),o}function Zn(t,e,r){if(e&&!t.L)throw Error("Can't create secondary domain capable XhrIo object.");return e=t.Aa&&!t.ma?new O(new Ce({ab:r})):new O(t.ma),e.Fa(t.L),e}n.isActive=function(){return!!this.l&&this.l.isActive(this)};function Qn(){}n=Qn.prototype,n.ra=function(){},n.qa=function(){},n.pa=function(){},n.oa=function(){},n.isActive=function(){return!0},n.Ka=function(){};function ee(){}ee.prototype.g=function(t,e){return new $(t,e)};function $(t,e){N.call(this),this.g=new Vn(e),this.l=t,this.h=e&&e.messageUrlParams||null,t=e&&e.messageHeaders||null,e&&e.clientProtocolHeaderRequired&&(t?t["X-Client-Protocol"]="webchannel":t={"X-Client-Protocol":"webchannel"}),this.g.o=t,t=e&&e.initMessageHeaders||null,e&&e.messageContentType&&(t?t["X-WebChannel-Content-Type"]=e.messageContentType:t={"X-WebChannel-Content-Type":e.messageContentType}),e&&e.sa&&(t?t["X-WebChannel-Client-Profile"]=e.sa:t={"X-WebChannel-Client-Profile":e.sa}),this.g.U=t,(t=e&&e.Qb)&&!l(t)&&(this.g.u=t),this.A=e&&e.supportsCrossDomainXhr||!1,this.v=e&&e.sendRawJson||!1,(e=e&&e.httpSessionIdParam)&&!l(e)&&(this.g.G=e,t=this.h,t!==null&&e in t&&(t=this.h,e in t&&delete t[e])),this.j=new vt(this)}I($,N),$.prototype.m=function(){this.g.l=this.j,this.A&&(this.g.L=!0),this.g.connect(this.l,this.h||void 0)},$.prototype.close=function(){Oe(this.g)},$.prototype.o=function(t){var e=this.g;if(typeof t=="string"){var r={};r.__data__=t,t=r}else this.v&&(r={},r.__data__=me(t),t=r);e.i.push(new fr(e.Ya++,t)),e.I==3&&Qt(e)},$.prototype.N=function(){this.g.l=null,delete this.j,Oe(this.g),delete this.g,$.Z.N.call(this)};function ti(t){ye.call(this),t.__headers__&&(this.headers=t.__headers__,this.statusCode=t.__status__,delete t.__headers__,delete t.__status__);var e=t.__sm__;if(e){t:{for(const r in e){t=r;break t}t=void 0}(this.i=t)&&(t=this.i,e=e!==null&&t in e?e[t]:void 0),this.data=e}else this.data=t}I(ti,ye);function ei(){ve.call(this),this.status=1}I(ei,ve);function vt(t){this.g=t}I(vt,Qn),vt.prototype.ra=function(){B(this.g,"a")},vt.prototype.qa=function(t){B(this.g,new ti(t))},vt.prototype.pa=function(t){B(this.g,new ei)},vt.prototype.oa=function(){B(this.g,"b")},ee.prototype.createWebChannel=ee.prototype.g,$.prototype.send=$.prototype.o,$.prototype.open=$.prototype.m,$.prototype.close=$.prototype.close,lo=function(){return new ee},co=function(){return qt()},ho=rt,ao={jb:0,mb:1,nb:2,Hb:3,Mb:4,Jb:5,Kb:6,Ib:7,Gb:8,Lb:9,PROXY:10,NOPROXY:11,Eb:12,Ab:13,Bb:14,zb:15,Cb:16,Db:17,fb:18,eb:19,gb:20},Gt.NO_ERROR=0,Gt.TIMEOUT=8,Gt.HTTP_ERROR=6,oo=Gt,yn.COMPLETE="complete",so=yn,fn.EventType=At,At.OPEN="a",At.CLOSE="b",At.ERROR="c",At.MESSAGE="d",N.prototype.listen=N.prototype.J,ro=fn,O.prototype.listenOnce=O.prototype.K,O.prototype.getLastError=O.prototype.Ha,O.prototype.getLastErrorCode=O.prototype.ya,O.prototype.getStatus=O.prototype.ca,O.prototype.getResponseJson=O.prototype.La,O.prototype.getResponseText=O.prototype.la,O.prototype.send=O.prototype.ea,O.prototype.setWithCredentials=O.prototype.Fa,io=O}).apply(typeof ie<"u"?ie:typeof self<"u"?self:typeof window<"u"?window:{});var uo="firebase",fo="12.19.0";/**
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
 */wt(uo,fo,"app");const Ri="@firebase/installations",Je="0.6.24";/**
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
 */const ki=1e4,Pi=`w:${Je}`,Mi="FIS_v2",po="https://firebaseinstallations.googleapis.com/v1",go=60*60*1e3,mo="installations",yo="Installations";/**
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
 */const vo={"missing-app-config-values":'Missing App configuration value: "{$valueName}"',"not-registered":"Firebase Installation is not registered.","installation-not-found":"Firebase Installation not found.","request-failed":'{$requestName} request failed with error "{$serverCode} {$serverStatus}: {$serverMessage}"',"app-offline":"Could not process request. Application offline.","delete-pending-registration":"Can't delete installation while there is a pending registration request."},ut=new Xe(mo,yo,vo);function Ni(n){return n instanceof St&&n.code.includes("request-failed")}/**
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
 */function ji({projectId:n}){return`${po}/projects/${n}/installations`}function Bi(n){return{token:n.token,requestStatus:2,expiresIn:bo(n.expiresIn),creationTime:Date.now()}}async function xi(n,i){const a=(await i.json()).error;return ut.create("request-failed",{requestName:n,serverCode:a.code,serverMessage:a.message,serverStatus:a.status})}function Li({apiKey:n}){return new Headers({"Content-Type":"application/json",Accept:"application/json","x-goog-api-key":n})}function wo(n,{refreshToken:i}){const s=Li(n);return s.append("Authorization",Eo(i)),s}async function Hi(n){const i=await n();return i.status>=500&&i.status<600?n():i}function bo(n){return Number(n.replace("s","000"))}function Eo(n){return`${Mi} ${n}`}/**
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
 */async function So({appConfig:n,heartbeatServiceProvider:i},{fid:s}){const a=ji(n),c=Li(n),w=i.getImmediate({optional:!0});if(w){const E=await w.getHeartbeatsHeader();E&&c.append("x-firebase-client",E)}const m={fid:s,authVersion:Mi,appId:n.appId,sdkVersion:Pi},S={method:"POST",headers:c,body:JSON.stringify(m)},_=await Hi(()=>fetch(a,S));if(_.ok){const E=await _.json();return{fid:E.fid||s,registrationStatus:2,refreshToken:E.refreshToken,authToken:Bi(E.authToken)}}else throw await xi("Create Installation",_)}/**
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
 */function Fi(n){return new Promise(i=>{setTimeout(i,n)})}/**
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
 */function Io(n){return btoa(String.fromCharCode(...n)).replace(/\+/g,"-").replace(/\//g,"_")}/**
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
 */const _o=/^[cdef][\w-]{21}$/,Ge="";function Ao(){try{const n=new Uint8Array(17);(self.crypto||self.msCrypto).getRandomValues(n),n[0]=112+n[0]%16;const s=To(n);return _o.test(s)?s:Ge}catch{return Ge}}function To(n){return Io(n).substr(0,22)}/**
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
 */function It(n){return`${n.appName}!${n.appId}`}/**
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
 */const Et=new Map;function $i(n,i){const s=It(n);Vi(s,i),Oo(s,i)}function Co(n,i){Ui();const s=It(n);let a=Et.get(s);a||(a=new Set,Et.set(s,a)),a.add(i)}function Do(n,i){const s=It(n),a=Et.get(s);a&&(a.delete(i),a.size===0&&Et.delete(s),zi())}function Vi(n,i){const s=Et.get(n);if(s)for(const a of s)a(i)}function Oo(n,i){const s=Ui();s&&s.postMessage({key:n,fid:i}),zi()}let lt=null;function Ui(){return!lt&&"BroadcastChannel"in self&&(lt=new BroadcastChannel("[Firebase] FID Change"),lt.onmessage=n=>{Vi(n.data.key,n.data.fid)}),lt}function zi(){Et.size===0&&lt&&(lt.close(),lt=null)}/**
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
 */const Ro="firebase-installations-database",ko=1,ft="firebase-installations-store";let Le=null;function Ye(){return Le||(Le=Ti(Ro,ko,{upgrade:(n,i)=>{switch(i){case 0:n.createObjectStore(ft)}}})),Le}async function oe(n,i){const s=It(n),c=(await Ye()).transaction(ft,"readwrite"),w=c.objectStore(ft),m=await w.get(s);return await w.put(i,s),await c.done,(!m||m.fid!==i.fid)&&$i(n,i.fid),i}async function Wi(n){const i=It(n),a=(await Ye()).transaction(ft,"readwrite");await a.objectStore(ft).delete(i),await a.done}async function he(n,i){const s=It(n),c=(await Ye()).transaction(ft,"readwrite"),w=c.objectStore(ft),m=await w.get(s),S=i(m);return S===void 0?await w.delete(s):await w.put(S,s),await c.done,S&&(!m||m.fid!==S.fid)&&$i(n,S.fid),S}/**
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
 */async function Ze(n){let i;const s=await he(n.appConfig,a=>{const c=Po(a),w=Mo(n,c);return i=w.registrationPromise,w.installationEntry});return s.fid===Ge?{installationEntry:await i}:{installationEntry:s,registrationPromise:i}}function Po(n){const i=n||{fid:Ao(),registrationStatus:0};return qi(i)}function Mo(n,i){if(i.registrationStatus===0){if(!navigator.onLine){const c=Promise.reject(ut.create("app-offline"));return{installationEntry:i,registrationPromise:c}}const s={fid:i.fid,registrationStatus:1,registrationTime:Date.now()},a=No(n,s);return{installationEntry:s,registrationPromise:a}}else return i.registrationStatus===1?{installationEntry:i,registrationPromise:jo(n)}:{installationEntry:i}}async function No(n,i){try{const s=await So(n,i);return oe(n.appConfig,s)}catch(s){throw Ni(s)&&s.customData.serverCode===409?await Wi(n.appConfig):await oe(n.appConfig,{fid:i.fid,registrationStatus:0}),s}}async function jo(n){let i=await gi(n.appConfig);for(;i.registrationStatus===1;)await Fi(100),i=await gi(n.appConfig);if(i.registrationStatus===0){const{installationEntry:s,registrationPromise:a}=await Ze(n);return a||s}return i}function gi(n){return he(n,i=>{if(!i)throw ut.create("installation-not-found");return qi(i)})}function qi(n){return Bo(n)?{fid:n.fid,registrationStatus:0}:n}function Bo(n){return n.registrationStatus===1&&n.registrationTime+ki<Date.now()}/**
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
 */async function xo({appConfig:n,heartbeatServiceProvider:i},s){const a=Lo(n,s),c=wo(n,s),w=i.getImmediate({optional:!0});if(w){const E=await w.getHeartbeatsHeader();E&&c.append("x-firebase-client",E)}const m={installation:{sdkVersion:Pi,appId:n.appId}},S={method:"POST",headers:c,body:JSON.stringify(m)},_=await Hi(()=>fetch(a,S));if(_.ok){const E=await _.json();return Bi(E)}else throw await xi("Generate Auth Token",_)}function Lo(n,{fid:i}){return`${ji(n)}/${i}/authTokens:generate`}/**
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
 */async function Qe(n,i=!1){let s;const a=await he(n.appConfig,w=>{if(!Gi(w))throw ut.create("not-registered");const m=w.authToken;if(!i&&$o(m))return w;if(m.requestStatus===1)return s=Ho(n,i),w;{if(!navigator.onLine)throw ut.create("app-offline");const S=Uo(w);return s=Fo(n,S),S}});return s?await s:a.authToken}async function Ho(n,i){let s=await di(n.appConfig);for(;s.authToken.requestStatus===1;)await Fi(100),s=await di(n.appConfig);const a=s.authToken;return a.requestStatus===0?Qe(n,i):a}function di(n){return he(n,i=>{if(!Gi(i))throw ut.create("not-registered");const s=i.authToken;return zo(s)?{...i,authToken:{requestStatus:0}}:i})}async function Fo(n,i){try{const s=await xo(n,i),a={...i,authToken:s};return await oe(n.appConfig,a),s}catch(s){if(Ni(s)&&(s.customData.serverCode===401||s.customData.serverCode===404))await Wi(n.appConfig);else{const a={...i,authToken:{requestStatus:0}};await oe(n.appConfig,a)}throw s}}function Gi(n){return n!==void 0&&n.registrationStatus===2}function $o(n){return n.requestStatus===2&&!Vo(n)}function Vo(n){const i=Date.now();return i<n.creationTime||n.creationTime+n.expiresIn<i+go}function Uo(n){const i={requestStatus:1,requestTime:Date.now()};return{...n,authToken:i}}function zo(n){return n.requestStatus===1&&n.requestTime+ki<Date.now()}/**
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
 */async function Wo(n){const i=n,{installationEntry:s,registrationPromise:a}=await Ze(i);return a?a.catch(console.error):Qe(i).catch(console.error),s.fid}/**
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
 */async function qo(n,i=!1){const s=n;return await Go(s),(await Qe(s,i)).token}async function Go(n){const{registrationPromise:i}=await Ze(n);i&&await i}/**
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
 */function Na(n,i){const{appConfig:s}=n;return Co(s,i),()=>{Do(s,i)}}/**
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
 */function Xo(n){if(!n||!n.options)throw He("App Configuration");if(!n.name)throw He("App Name");const i=["projectId","apiKey","appId"];for(const s of i)if(!n.options[s])throw He(s);return{appName:n.name,projectId:n.options.projectId,apiKey:n.options.apiKey,appId:n.options.appId}}function He(n){return ut.create("missing-app-config-values",{valueName:n})}/**
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
 */const Xi="installations",Ko="installations-internal",Jo=n=>{const i=n.getProvider("app").getImmediate(),s=Xo(i),a=Ci(i,"heartbeat");return{app:i,appConfig:s,heartbeatServiceProvider:a,_delete:()=>Promise.resolve()}},Yo=n=>{const i=n.getProvider("app").getImmediate(),s=Ci(i,Xi).getImmediate();return{getId:()=>Wo(s),getToken:c=>qo(s,c)}};function Zo(){Ft(new bt(Xi,Jo,"PUBLIC")),Ft(new bt(Ko,Yo,"PRIVATE"))}/**
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
 */Zo();wt(Ri,Je);wt(Ri,Je,"esm2020");export{pa as $,aa as A,ba as B,bt as C,Ea as D,ho as E,St as F,Hr as G,ra as H,eo as I,Dr as J,fa as K,ts as L,no as M,ii as N,da as O,ma as P,va as Q,Aa as R,ao as S,Sa as T,vi as U,Or as V,ro as W,io as X,_a as Y,ga as Z,ka as _,D as a,ya as a0,Qo as a1,Ta as a2,Pr as a3,ha as a4,ta as a5,Ma as a6,na as a7,zs as a8,$r as a9,ua as aa,Ti as ab,Ra as ac,Na as ad,Ci as b,so as c,$e as d,oo as e,lo as f,co as g,ca as h,Da as i,Ei as j,Nr as k,Fr as l,la as m,Ca as n,Ft as o,Oa as p,Pa as q,wt as r,ea as s,ia as t,oa as u,sa as v,Xe as w,Ia as x,Fe as y,wa as z};
