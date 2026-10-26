import { writeFileSync } from 'node:fs';

const pages = await (await fetch('http://127.0.0.1:9223/json')).json();
const page = pages.find(page => page.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let nextId = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
    const message = JSON.parse(event.data);
    if (message.id) {
        const task = pending.get(message.id);
        if (!task) return;
        pending.delete(message.id);
        if (message.error) task.reject(message.error);
        else task.resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text + ': ' + (message.params.exceptionDetails.exception?.description || ''));
    if (message.method === 'Network.loadingFailed') errors.push(message.params);
});
function call(method, params = {}) {
    const id = ++nextId;
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        socket.send(JSON.stringify({ id, method, params }));
    });
}
async function evaluate(expression) {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
    return response.result.value;
}
await call('Runtime.enable');
await call('Network.enable');
if (process.argv.includes('--navigate')) await call('Page.navigate', { url: 'http://localhost:3001/?projectId=153_L1' });
if (process.argv.includes('--inspect')) {
    console.log(JSON.stringify(await evaluate(`({title:document.title,text:document.body.innerText.slice(0,3000),canvases:[...document.querySelectorAll('canvas')].map(c=>({width:c.width,height:c.height,cssWidth:c.clientWidth,cssHeight:c.clientHeight}))})`), null, 2));
} else if (process.argv.includes('--measure')) {
    console.log(JSON.stringify(await evaluate(`(async () => {
        const {default:useGame}=await import('/src/hooks/useGame.tsx');
        const state=useGame.getState();
        const scene=state.sceneRef?.current || state.sceneRef;
        const controls=state.orbitControlsRef?.current || state.orbitControlsRef;
        window.__orbitTest={scene,controls};
        const counts={objects:0,meshes:0,instances:0,labels:0,triangles:0};
        scene?.traverse(o=>{counts.objects++; if(o.isMesh&&!o.userData.spatialInstanceCulling){counts.meshes++;counts.triangles+=(o.geometry?.index?.count || o.geometry?.attributes?.position?.count || 0)/3*(o.isInstancedMesh?o.count:1)} if(o.isInstancedMesh&&!o.userData.spatialInstanceCulling)counts.instances+=o.count; if(o.userData?.isBuildingLabel)counts.labels++});
        return {project:state.projectID,counts,controls:!!controls,keys:Object.keys(state).filter(k=>/ref/i.test(k)),text:document.body.innerText.slice(0,500)};
    })()`), null, 2));
} else if (process.argv.includes('--visual-check')) {
    console.log(JSON.stringify(await evaluate(`(async()=>{
        const {default:g}=await import('/src/hooks/useGame.tsx');
        const s=g.getState().sceneRef.current,root=s.__r3f.root.getState(),gl=root.gl,ctx=gl.getContext();
        const sources=[];s.traverse(o=>{if(o.userData.spatialInstanceCulling)sources.push(o)});
        const w=gl.domElement.width,h=gl.domElement.height;
        const capture=()=>{gl.render(s,root.camera);const pixels=new Uint8Array(w*h*4);ctx.readPixels(0,0,w,h,ctx.RGBA,ctx.UNSIGNED_BYTE,pixels);return pixels};
        const optimized=capture();
        const saved=sources.map(m=>({m,before:m.onBeforeRender,after:m.onAfterRender}));
        for(const {m} of saved){m.onBeforeRender=()=>{};m.onAfterRender=()=>{};m.children.forEach(c=>c.visible=false)}
        const original=capture();
        for(const {m,before,after} of saved){m.onBeforeRender=before;m.onAfterRender=after;m.children.forEach(c=>c.visible=true)}
        let changed=0,totalError=0,maxError=0;
        for(let i=0;i<original.length;i+=4){let difference=0;for(let c=0;c<3;c++){const error=Math.abs(original[i+c]-optimized[i+c]);difference=Math.max(difference,error);totalError+=error;maxError=Math.max(maxError,error)}if(difference>2)changed++}
        capture();return {pixels:w*h,changedPixels:changed,changedPercent:changed/(w*h)*100,meanChannelError:totalError/(w*h*3),maxError,antialias:ctx.getContextAttributes().antialias};
    })()`),null,2));
} else if (process.argv.includes('--orbit')) {
    if (process.argv.includes('--baseline')) await evaluate('window.__orbitBaseline=[]');
    await evaluate(`(async()=>{
        const {default:useGame}=await import('/src/hooks/useGame.tsx');
        const state=useGame.getState(),scene=state.sceneRef.current,controls=state.orbitControlsRef.current;
        controls.object.position.set(5,25,50);controls.target.set(0,0,0);controls.update();
        const root=scene.__r3f?.root?.getState();
        const gl=root?.gl;
        window.__orbitTest={scene,controls,gl,frames:[],renders:[],longTasks:[],sizes:[],samples:[],running:true};
        const t=window.__orbitTest;
        if(window.__orbitBaseline){scene.traverse(m=>{if(m.userData.spatialInstanceCulling){window.__orbitBaseline.push({m,before:m.onBeforeRender,after:m.onAfterRender});m.onBeforeRender=()=>{};m.onAfterRender=()=>{};m.children.forEach(c=>c.visible=false)}})}
        new PerformanceObserver(list=>t.longTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration})))).observe({type:'longtask',buffered:false});
        let previous=performance.now();
        const tick=now=>{t.frames.push(now-previous);previous=now;t.sizes.push([gl?.domElement.width,gl?.domElement.height]);t.samples.push([now,...controls.object.position.toArray()]);if(t.running)requestAnimationFrame(tick)};
        requestAnimationFrame(tick);
        if(gl){t.originalRender=gl.render; gl.render=function(...args){const start=performance.now(); const r=t.originalRender.apply(this,args);t.renders.push({ms:performance.now()-start,...this.info.render});return r}};
    })()`);
    const box = await evaluate(`(()=>{const r=document.querySelector('.canvas-element canvas').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height}})()`);
    const x = box.x + box.width * 0.5, y = box.y + box.height * 0.5;
    await call('Input.dispatchMouseEvent', { type:'mousePressed', x,y,button:'left',buttons:1,clickCount:1 });
    for (let i=0;i<180;i++) {
        await call('Input.dispatchMouseEvent', { type:'mouseMoved', x:x+Math.sin(i/40)*220,y:y+Math.sin(i/60)*50,button:'left',buttons:1 });
        await new Promise(resolve=>setTimeout(resolve,16));
    }
    await call('Input.dispatchMouseEvent', { type:'mouseReleased',x,y,button:'left',buttons:0,clickCount:1 });
    const report = await evaluate(`(()=>{const t=window.__orbitTest;t.running=false;if(t.gl)t.gl.render=t.originalRender;
        const stats=a=>{a.sort((a,b)=>a-b);return {count:a.length,mean:a.reduce((a,b)=>a+b,0)/a.length,p50:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:a.at(-1)}};
        const ctx=t.gl?.getContext(),debug=ctx?.getExtension('WEBGL_debug_renderer_info');
        const baseline=!!window.__orbitBaseline;
        if(baseline){for(const {m,before,after} of window.__orbitBaseline){m.onBeforeRender=before;m.onAfterRender=after;m.children.forEach(c=>c.visible=true)}delete window.__orbitBaseline}
        return {baseline,frames:stats(t.frames.slice(2)),render:stats(t.renders.map(r=>r.ms)),draw:t.renders.at(-1),sizes:[...new Set(t.sizes.map(s=>s.join('x')))],longTasks:t.longTasks,position:t.controls.object.position.toArray(),antialias:ctx?.getContextAttributes().antialias,gpu:debug?ctx.getParameter(debug.UNMASKED_RENDERER_WEBGL):null}})()`);
    console.log(JSON.stringify(report,null,2));
    if (process.argv.includes('--output')) writeFileSync(process.argv[process.argv.indexOf('--output') + 1], JSON.stringify(report,null,2)+'\n');
} else if (process.argv.includes('--eval')) {
    console.log(JSON.stringify(await evaluate(process.argv[process.argv.indexOf('--eval') + 1]), null, 2));
} else if (process.argv.includes('--screenshot')) {
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    writeFileSync('orbit-test.png', Buffer.from(shot.data, 'base64'));
    console.log('Saved orbit-test.png');
} else if (process.argv.includes('--close')) {
    await call('Browser.close');
}
console.log(JSON.stringify({errors:errors.slice(-10)}));
socket.close();
