//region imports
var fs =require("fs");
const {parse} = require("@babel/parser");
const {default: traverse} = require("@babel/traverse");
const types = require("@babel/types");
const prefixes = require("./prefixes");
const {ObjectProperty} = require("@babel/types");
const assert = require("assert");
const {ReferencedMemberExpression} = require("@babel/traverse/lib/path/lib/virtual-types");
const beautify =require("js-beautify").js;
const generate = require('@babel/generator').default

//endregion
let fileName = "./scripts.js"
// fileName = "./rabbitstream.js"
// fileName = "./dokicloud.js"
const outputFilename=fileName.replace(".js",".cleaned.js")
let script = fs.readFileSync(fileName).toString()

let ast = parse(script);

//region finding the decrypt functions and arrays
console.log('\x1b[31m%s\x1b[0m','Finding decryption functions...')

let decryptArrayBindings=[]
let importantThings = []
let decryptFunctionBindings=[]
traverse(ast, {
    FunctionDeclaration(path) {
        const {node,scope} = path
        let name= node.id.name
        let isDecryptFunction=false
        let isKeyArray=false
        path.traverse({
            ArrayExpression(childPath){
                if(childPath.node.elements.length>10 &&
                    types.isVariableDeclaration(childPath.parentPath.parentPath)&&
                    types.isBlockStatement(childPath.parentPath.parentPath.parentPath)
                ){
                    const siblings=childPath.parentPath.parentPath.getAllNextSiblings()
                    if(types.isExpressionStatement(siblings[0])&&types.isReturnStatement(siblings[1])&&siblings.length===2){
                        eval(path.toString())
                        console.log('Found Decrypt Array Function',name)
                        decryptArrayBindings.push(scope.getBinding(node.id.name))
                        childPath.stop()
                    }
                }

            },
        })
        if(isDecryptFunction===false && types.isProgram(path.parentPath)){
            // console.log(name)
            importantThings.push(script.substring(node.start,node.end))
        }
    },
    VariableDeclarator(path){
        if(types.isVariableDeclaration(path.parentPath) &&
            types.isProgram(path.parentPath.parentPath)
        ){
            if(types.isIdentifier(path.node.init)){
                // console.log(path.toString())
                importantThings.push('var '+path.toString())

            }
            else if(types.isCallExpression(path.node.init)){
                if(types.isFunctionExpression(path.node.init.callee)){
                    // console.log(path.toString())
                    // console.log(path.node.init.callee)
                    importantThings.push('var '+path.toString())
                }
            }
        }
    }
});
console.log('\x1b[31m%s\x1b[0m','Rotating decryption arrays...')
var rotators = []
decryptArrayBindings.forEach((binding)=>{
    binding.referencePaths.forEach((refPath)=>{
        if(types.isCallExpression(refPath.parentPath)){
            const callExpr=refPath.parentPath
            const callExprArgs=callExpr.node.arguments
            if(callExprArgs[0]===refPath.node&&(types.isBinaryExpression(callExprArgs[1])||types.isNumericLiteral(callExprArgs[1]))&&callExprArgs.length===2){
                console.log("Found Decrypt Array Rotator!")
                rotators.push('('+refPath.parentPath.toString()+')');
                refPath.parentPath.remove()
            }else{
                if(!refPath.node)return
                if(!types.isReturnStatement(refPath.parentPath.parentPath)&&refPath.getFunctionParent().node.id.name!==refPath.node.id){
                    // console.log(refPath.parentPath.parentPath.type)
                    const functionParent=refPath.getFunctionParent()
                    const binding=functionParent.scope.getBinding(functionParent.node.id.name)
                    if(!decryptFunctionBindings.includes(binding)){
                        importantThings.push(script.substring(functionParent.node.start,functionParent.node.end));
                        console.log('Found Decrypt Function',functionParent.node.id.name)
                        decryptFunctionBindings.push(binding)
                    }
                }else{
                }
            }

        }
    })
    binding.path.remove()
})
eval(importantThings.join(';'))
eval(rotators.join(';'))
console.log('\x1b[31m%s\x1b[0m','Finding decryption decryption function usages...')

let unusedBindings=[]
decryptFunctionBindings.forEach(function(binding){
    if(binding.path.node===null)return;
    binding.referencePaths.forEach(function(refPath){
        checkReference(refPath,binding.path.node.id.name)
    })
    binding.path.remove()
})
function checkReference(refPath,decryptFuncName,verbose=false){
    if(types.isCallExpression(refPath.parentPath)){
        if(!refPath.parentPath.node.arguments.every(arg=>!types.isIdentifier(arg)))return
        refPath.parentPath.node.callee.name=decryptFuncName
        try{
            const evaluated=eval(refPath.parentPath.toString())
            if(verbose)console.log("Evaluated decrypt call expression", refPath.parentPath.toString(),"to",evaluated)
            refPath.parentPath.replaceWith(types.StringLiteral(evaluated))
        }catch (e){
            console.log('Failed to evaluate',refPath.parentPath.parentPath.toString())
        }
    }
    else if(types.isVariableDeclarator(refPath.parentPath)){
        let binding = refPath.scope.getBinding(refPath.parentPath.node.id.name)
        binding.referencePaths.forEach(function (childRefPath) {
            checkReference(childRefPath,decryptFuncName)
        })
    }

}
//endregion

inlineAndEvaluate(ast)

inlineObject(ast,true,true)

inlineAndEvaluate(ast)

inlineSimpleFunctions(ast)
inlineAndEvaluate(ast)

traverse(ast,{
    WhileStatement(path) {
        let switchNode = path.node.body.body[0];

        if(types.isSwitchStatement(switchNode)){
            let arrayName = switchNode.discriminant.object.name;
            let prevSiblings = path.getAllPrevSiblings();
            let array = []
            prevSiblings.forEach(pervNode => {
                if(!pervNode.node.declarations)return
                let {id, init} = pervNode.node.declarations[0];
                if (arrayName === id.name) {
                    let object = init.callee.object.value;
                    let property = init.callee.property.value;
                    let argument = init.arguments[0].value;
                    if(!object)return
                    array = object[property](argument)
                }
                pervNode.remove();
            })
            let replace = [];
            array.forEach(index => {
                    let consequent = switchNode.cases[index].consequent;
                    if (types.isContinueStatement(consequent[consequent.length - 1])) {
                        consequent.pop();
                    }
                    replace = replace.concat(consequent);
                }
            );
            path.replaceWithMultiple(replace);
        }
        else{
            // console.log(switchNode)
        }
    }
})
removeDeadCode(ast)

memberLiteralToIdentifier(ast)

createOutput(true,true)


function inlineAndEvaluate(ast){
    console.log('\x1b[31m%s\x1b[0m','Inlining And Evaluating')

    try{
        traverse(ast, {
            VariableDeclarator(path){
                inlineVariables(path,false)
            },
            "BinaryExpression|ConditionalExpression|CallExpression"(path){
                evaluateExpression(path,false)
            },
        });
    }catch (e){
        console.log(e.message,'when Inlining And Evaluating')
        // createOutput()
        // script = fs.readFileSync(outputFilename).toString()
        // ast = parse(script);
        // inlineAndEvaluate(ast)
    }
    function evaluateExpression(path,verbose=false){
        const {confident, value} = path.evaluate()
        if(confident){
            if(verbose)console.log('Evaluated',path.toString(),'to',value)
            path.replaceWith(types.valueToNode(value))
            path.skip()
        }
    }
    function inlineVariables(path,verbose=false){
        let binding = path.scope.getBinding(path.node.id.name);if(!binding || !path.node.init)return;
        if(!binding.referenced){
            path.remove()
            return
        }
        if(types.isForStatement(path.parentPath.parentPath))return

        let inlinedPath=path.get('init')
        let inlinedValue = inlinedPath.toString();
        if(inlinedValue==="'0'"||inlinedValue==='"0"'||inlinedValue==='""')return;

        let inlinedNode=inlinedPath.node

        const inlinedType=inlinedNode.type;
        switch(inlinedType){
            case 'MemberExpression':
            case 'RegExpLiteral':
            case 'StringLiteral':
            case 'Identifier':
            case 'ThisExpression':
                break;
            case 'CallExpression':
                return;
            case 'BinaryExpression':
                const {confident, value} =inlinedPath.evaluate()
                if(confident && typeof value!=='number'){
                    inlinedValue=value
                    inlinedNode = types.valueToNode(value)
                }else{
                    return
                }
                break;
            case 'UnaryExpression':
                if(inlinedValue==='![]'){
                    inlinedValue=false
                    inlinedNode=types.booleanLiteral(false)

                }else if(inlinedValue === '!![]'){
                    inlinedNode=types.booleanLiteral(true)
                    inlinedValue=true
                }
                break;
            default:
                if(!(['AssignmentExpression','NewExpression','LogicalExpression','ObjectExpression','FunctionExpression','ConditionalExpression','ArrayExpression','NullLiteral','NumericLiteral'].includes(inlinedType))){
                    // console.log(inlinedType)//
                    // console.log(inlinedValue)
                }
                return
        }
        let count=0
        let shouldRemove = true
        binding.referencePaths.reverse().forEach(function(refPath){
            if(inlinedType==='MemberExpression'){
                //todo
                shouldRemove=false
            }else{
                refPath.replaceWith(inlinedNode)
                ++count
            }
        })
        if(verbose)console.log('Inlined',path.node.id.name,'with',inlinedType,'\''+inlinedValue+'\'',count,'time(s)')
        if(shouldRemove)path.remove();

    }
}
function inlineObject(ast,forceInline=true,verbose = false){
    // createOutput()
    console.log("inline objects")
    function tryForceInline(path,refPath){
        try{
            if(!refPath.parentPath.parentPath.get('callee').node.property)return
            // console.log(refPath.parentPath.parentPath.toString())
            const calleePropertyName = refPath.parentPath.parentPath.get('callee.property').node.value
            path.traverse({
                ObjectProperty(propertyPath) {
                    if(propertyPath.node.key.name === calleePropertyName){
                        const params = propertyPath.get('value.params').toString().split(',')
                        const inputParams = refPath.parentPath.parentPath.node.arguments
                        assert(propertyPath.get('value.body.body').length===1,"failed")//todo
                        // console.log("before",refPath.parentPath.parentPath.toString())

                        refPath.parentPath.parentPath.replaceWith(types.cloneDeepWithoutLoc(propertyPath.get('value.body.body.0.argument').node))
                        refPath.parentPath.parentPath.traverse({
                            Identifier(inputParamPath){
                                let index = params.indexOf(inputParamPath.toString())
                                if(index>-1){
                                    try{
                                        inputParamPath.replaceWith(inputParams[index])
                                    }catch (e){
                                        console.log(e.message)
                                    }
                                    inputParamPath.skip()
                                }
                            }
                        })

                        // console.log("after",refPath.parentPath.parentPath.toString())
                        // console.log()

                    }
                }
            })
        }catch (e){
            if(verbose)console.log(e.message)
        }
    }
    traverse(ast,{
        VariableDeclarator(path){

            const init = path.get('init')
            if(!types.isObjectExpression(init.node))return
            try{
                eval(path.toString())
            }catch (e){
                // console.log("Failed to eval object declaration",path.toString())
                console.log(e.message)
                return
            }

            path.scope.crawl()
            let binding = path.scope.getBinding(path.node.id.name);if(!binding)return;
            binding.referencePaths.reverse().forEach((refPath)=>{
                if(types.isAssignmentExpression(refPath.parentPath.parentPath)){
                    const toEval = refPath.parentPath.parentPath.toString()
                    try{
                        eval(toEval)
                        // console.log(toEval)
                        //refPath.parentPath.parentPath.remove()
                    }catch (e){
                        if(verbose)console.log(e.message)
                        // console.log(refPath.parentPath.parentPath.toString())
                    }
                }

            })


            binding.referencePaths.forEach((refPath)=>{
                let toEval = refPath.parentPath.parentPath
                if(types.isUpdateExpression(toEval))return
                if(types.isAssignmentExpression(toEval))return

                if(types.isCallExpression(toEval)){

                    if(types.isForStatement(toEval.parentPath)&& toEval===toEval.parentPath.get('test'))return //info in a for loop
                    if(toEval.toString().includes('setTimeout')||toEval.toString().includes('Object'))return


                    if(refPath.parentPath.parentPath.get('arguments').every(it=>{
                        return it.node.type !== 'Identifier';
                    })){
                        try{
                            let evaluated=eval(toEval.toString())
                            if(verbose)console.log("evaluated ",toEval,'to',evaluated)
                            refPath.parentPath.parentPath.replaceWith(types.valueToNode(evaluated))
                        }catch (e){
                            if(verbose)console.log('Line 309: Failed to eval',toEval.toString())
                            if(verbose)console.log(e.message)
                            if(forceInline)tryForceInline(path,refPath)

                        }
                    }else{
                        if(forceInline)tryForceInline(path,refPath)
                    }
                }
                else if(types.isMemberExpression(refPath.parentPath)){
                    const toEval = refPath.parentPath.toString()
                    try{
                        const evaluated = eval(toEval)
                        if(evaluated===undefined || evaluated===0 || Array.isArray(evaluated))return
                        refPath.parentPath.replaceWith(types.valueToNode(evaluated))
                        if(verbose)console.log("evaluated ",toEval,'to',evaluated,'\n')
                    }catch (e){
                        if(verbose)console.log('Line 338: Failed to eval ',toEval,':',e.message)
                    }
                }
                else{
                    // console.log(refPath.parentPath.toString())
                }
            })

        },
        MemberExpression(path){

            if(types.isUpdateExpression(path.parentPath) || types.isThisExpression(path.node.object))return
            const toEval = path.toString()
            try{
                const evaluated=eval(toEval)

                if(typeof evaluated ==='function' || evaluated===undefined || evaluated===0 || Array.isArray(evaluated))return
                path.replaceWith(types.valueToNode(evaluated))
                if(verbose)console.log("Evaluated ",toEval,'to',evaluated.toString())
            }catch (e){
                if(verbose)console.log("Line 353: Failed to eval",toEval,':',e.message)
            }

        }
    })
}
function memberLiteralToIdentifier(ast){
    traverse(ast,{
        MemberExpression(path){
            const {node}=path
            const prop = node.property;
            const convertable=/^\D\w+$/

            if(types.isStringLiteral(prop)&&convertable.test(prop.value)){
                node.property = types.identifier(prop.value);
                node.computed = false;
            }
        },
    })
}
function inlineSimpleFunctions(ast){
    console.log('\x1b[31m%s\x1b[0m','Simplifying functions')
    let simpleFunctionBindings=[];
    traverse(ast,{
        FunctionDeclaration(path){
            return;
            let binding = path.scope.getBinding(path.node.id.name);if(!binding)return;
            const body = path.get('body.body')
            const bodyStr = body.toString()
            const returnRegex = /^return ([^(]{1,3}\(\)|\d+);?/gm
            let returnBlock = returnRegex.exec(bodyStr)
            if(!returnBlock)return;
            let inlineReturnVal;
            simpleFunctionBindings.push(binding)
            // console.log(binding.path.toString())
            // console.log(path.get('body.body.0.argument').type)
            // binding.referencePaths.forEach((refPath)=>{
            //     if(!types.isCallExpression(refPath.parentPath))return;
            //     refPath.parentPath.replaceWith(path.get('body.body.0.argument'))
            //     console.log("repalcing",refPath.parentPath.toString(),"")
            // })
        },
        CallExpression(path){
            // console.log(path.get('callee').toString())
            const binding = path.scope.getBinding(path.get('callee').toString())
            if(!binding)return;
            const returnRegex = /^return ([^(]{1,3}\(\)|\d+);?/gm

            if(!types.isFunctionDeclaration(binding.path)||!returnRegex.test(binding.path.get('body.body').toString())){
                // console.log(binding.path.toString())
                return;
            }

            // console.log(binding.path.parentPath.parentPath.toString())
            // const body = binding.path.get('body.body')
            // const bodyStr = body.toString()
            // console.log(bodyStr)
            // console.log(path.toString())
            // console.log(binding.path.toString())
            // console.log(binding.path.toString())
            path.replaceWith(binding.path.get('body.body.0.argument'))
            path.scope.crawl()

            // console.log()
        }
    })
}
function removeDeadCode(ast){
    console.log('\x1b[31m%s\x1b[0m','Removing dead code')

    traverse(ast,{
        VariableDeclarator(path){
            return;
            const binding = path.scope.getBinding(path.node.id.name)
            if(!binding)return;
            if(binding.referencePaths.length<=1){
                console.log('removed',path.toString())
                try{
                    path.remove();
                }catch (e){
                    console.log(e.message)
                }
            }
        },
        FunctionDeclaration(path) {
            let binding = path.scope.getBinding(path.node.id.name);
            if (!binding) return;

            if(binding.referencePaths.length<=1){
                console.log('removed',path.toString())
                try{
                    path.remove();
                }catch (e){
                    console.log(e.message)
                }
            }
        }
    })
}


function createOutput(exit=true,shouldBeautify=true){
    let deobfuscated;
    fs =require("fs")
    function writeToFile(filename=outputFilename){
        if(shouldBeautify){
            fs.writeFileSync(filename,beautify(deobfuscated,{ indent_size: 2, space_in_empty_paren: true }))
        }else{
            fs.writeFileSync(filename,deobfuscated)
        }
    }
    const output= generate(ast,
        {
            compact: true,
            // retainLines:false,
            // retainFunctionParens:false,
            minified:true,
            concise:true,
        }
        , script);
    // deobfuscated= prefixes+output.code
    deobfuscated= output.code
    writeToFile()
    if(exit) {
        console.log('finished')
        process.exit()
    }
    return deobfuscated
}



