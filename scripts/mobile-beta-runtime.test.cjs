// Execute actual mobile App source with synthetic native modules and no effects/network.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=process.env.MOBILE_RUNTIME_SOURCE||'C:/Projects/wadatrip-mobile';
function fixture({enabled=false,user={id:'synthetic-user'}}={}){
 let cursor=0;const states=[false,true,'',user,0];
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),Fragment:'Fragment',useState:()=>[states[cursor++],()=>{}],useEffect:()=>{}};
 const Agent=()=>null;
 const component=()=>null;
 const req=n=>n==='react'?React:n==='expo-constants'?{expoConfig:{extra:{ENABLE_WADA_AGENT:enabled}}}:
 n==='react-native'?{Platform:{OS:'android'},StyleSheet:{create:x=>x,absoluteFill:{}},View:component,Text:component,ActivityIndicator:component,StatusBar:component,Pressable:component}:
 n==='@react-navigation/native'?{NavigationContainer:component,createNavigationContainerRef:()=>({isReady:()=>true})}:
 /@react-navigation\/(stack|bottom-tabs)/.test(n)?{createStackNavigator:()=>({Navigator:component,Screen:component}),createBottomTabNavigator:()=>({Navigator:component,Screen:component})}:
 n==='react-native-paper'?{Provider:component}:n==='expo-linear-gradient'?{LinearGradient:component}:
 n.includes('WadaAgent')?Agent:n.includes('/theme/brand')?{brand:{colors:{heroStart:'#000'},gradients:{hero:[]}}}:
 n.includes('i18n')?{language:'en'}:component;
 const m={exports:{}};const code=ts.transpileModule(fs.readFileSync(path.join(root,'App.js'),'utf8'),{compilerOptions:{allowJs:true,jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true,target:ts.ScriptTarget.ES2022}}).outputText;
 vm.runInNewContext(code,{module:m,exports:m.exports,require:req,process:{env:{}},__DEV__:false,console});
 const render=()=>{cursor=0;return m.exports.default()};
 const contains=(node,type)=>!!node&&(Array.isArray(node)?node.some(n=>contains(n,type)):typeof node==='object'&&(node.type===type||contains(node.props?.children,type)));
 return {render,contains,Agent};
}
test('disabled experimental agent does not mount or start background animation work',()=>{const f=fixture();assert.equal(f.contains(f.render(),f.Agent),false)});
test('experimental agent never mounts on the signed-out screen',()=>{const f=fixture({enabled:true,user:null});assert.equal(f.contains(f.render(),f.Agent),false)});
test('explicitly enabled agent remains available to signed-in users',()=>{const f=fixture({enabled:true});assert.equal(f.contains(f.render(),f.Agent),true)});
test('provider component identity stays stable across app state renders',()=>{const f=fixture();assert.equal(f.render().type,f.render().type)});

function adapter(file){
 const source=fs.readFileSync(path.join(root,'src/screens',file),'utf8');
 const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
 let found;
 function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(ast)==='normalizeListing')found=node.initializer.getText(ast);ts.forEachChild(node,visit)}visit(ast);
 assert.ok(found,'Actual listing adapter is required');return vm.runInNewContext('('+found+')');
}
for(const[field,expected]of [['durationMinutes',360],['currency','EUR'],['country','ZA']])test('catalog to detail preserves server '+field,()=>{
 const row={id:'synthetic-listing',title:'Synthetic Experience',city:'Synthetic City',country_code:'ZA',currency:'EUR',price_from:'50',duration_minutes:360};
 assert.equal(adapter('TourDetailScreen.js')(adapter('ToursScreen.js')(row))[field],expected);
});
