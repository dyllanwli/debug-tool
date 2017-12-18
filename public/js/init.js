window.onload = function(){    
    var p = document.createElement("p");
    p.innerHTML = "this is created dynamically"
    document.body.appendChild(p);
    // this is terminal
    var btn1 = document.getElementById("terminal");
    btn1.onclick = function(){
        window.open('http://localhost:8088/terminal');
    };
    
    
    // get the token
    var getFileContent = function (fileInput, callback) {
        if (fileInput.files && fileInput.files.length > 0 && fileInput.files[0].size > 0) {
            var file = fileInput.files[0];
            if (window.FileReader) {
                var reader = new FileReader();
                reader.onloadend = function (evt) {
                    if (evt.target.readyState == FileReader.DONE) {
                        callback(evt.target.result);
                    }
                };
                reader.readAsText(file, 'utf-8');
            }
        }
    };
    document.getElementById('loadToken').onchange = function () {
        var content = document.getElementById('token');
        getFileContent(this, function (str) {
            content.value = str;
        });
    };
    
    // this is channels
    var xhr = new XMLHttpRequest();
    var btn2 = document.getElementById("createChannel");
    btn2.onclick = function(){
        var token = document.getElementById("token").value;
        var vchannelName = document.getElementById("channelName").value;
        var vchannelConfigPath = document.getElementById("channelConfigPath").value;
        var jsonData = JSON.stringify({
            channelName: vchannelName,
            channelConfigPath: vchannelConfigPath
        })
        xhr.open("POST", "/channels", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ token);
        xhr.send(jsonData);
    };
    
    // join channels
    var xhr = new XMLHttpRequest();
    var btn3 = document.getElementById("joinChannel");
    btn3.onclick = function(){
        var token = document.getElementById("token").value;
        var vchannelName = document.getElementById("join_channelName").value;
        var vpeers = document.getElementById("join_peers").value.split(",");
        var jsonData = JSON.stringify({
            peers: vpeers
        });
        // window.alert(jsonData);
        xhr.open("POST", "/channels/"+vchannelName+"/peers", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ token);
        xhr.send(jsonData);
    };
    

    // install chaincode
    var xhr = new XMLHttpRequest();
    var btn4 = document.getElementById("installChaincode");
    btn4.onclick = function(){
        var token = document.getElementById("token").value;
        var vchaincodeName = document.getElementById("install_chaincodeName").value;
        var vpeers = document.getElementById("install_peers").value.split(",");
        var vchaincodeVersion = document.getElementById("install_chaincodeVersion").value;
        var vchaincodePath = document.getElementById("install_chaincodePath").value;
        var jsonData = JSON.stringify({
            peers: vpeers,
            chaincodeName: vchaincodeName,
            chaincodePath: vchaincodePath,
            chaincodeVersion: vchaincodeVersion
        });
        // window.alert(jsonData);
        xhr.open("POST", "/chaincodes", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ token);
        xhr.send(jsonData);
    };

    // instantiate 
    var xhr = new XMLHttpRequest();
    var btn5 = document.getElementById("instantiateChaincode");
    btn5.onclick = function(){
        var token = document.getElementById("token").value;
        var vargs = document.getElementById("instan_args").value.split(",");
        var vchannelName = document.getElementById("instan_channelName").value;
        var vchaincodeName = document.getElementById("instan_chaincodeName").value;
        var vchaincodeVersion = document.getElementById("instan_chaincodeVersion").value;
        // var vfcn = document.getElementById("instan").values
        var jsonData = JSON.stringify({
            args: vargs,
            chaincodeName: vchaincodeName,
            chaincodeVersion: vchaincodeVersion
        });
        // window.alert(jsonData);
        xhr.open("POST", "/channels/"+vchannelName+"/chaincodes", true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ token);
        xhr.send(jsonData);
    };

    // invoke chaincode 
    // TODO: support json invoke
    var xhr = new XMLHttpRequest();
    var btn6 = document.getElementById("invokeTransaction");
    btn6.onclick =function(){
        var token = document.getElementById("token").value;
        var vchannelName = document.getElementById("invoke_channelName").value;
        var vchaincodeName = document.getElementById("invoke_chaincodeName").value;
        // TODO
        var vargs = document.getElementById("invoke_args").value.split(",");
        var vfcn = document.getElementById("invoke_fcn").value;
        var jsonData = JSON.stringify({
            args: vargs,
            fcn:vfcn
        });
        window.alert(jsonData);
        xhr.open("POST", "/channels/"+vchannelName+"/chaincodes/"+vchaincodeName, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ token);
        xhr.send(jsonData);
    }

    //query chaincode 
    var query1 = document.getElementById("query1");
    var query2 = document.getElementById("query2");
    var query3 = document.getElementById("query3");
    var query4 = document.getElementById("query4");
    var query5 = document.getElementById("query5");
    var query6 = document.getElementById("query6");
    // click incident
    query1.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        parameter.vquery_args = "[\""+parameter.vquery_args+"\"]";
        parameter.vquery_args = escape(parameter.vquery_args);
        url = "/channels/"+parameter.vquery_channelName+"/chaincodes/"+parameter.vquery_chaincodeName+"?peer="+ parameter.vquery_peer+"&fcn="+parameter.vquery_fcn+"&args="+parameter.vquery_args;
        // window.alert(url);
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.responseType = "blob";
        xhr.send();
    };
    query2.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        url = "/channels/"+parameter.vquery_channelName+"/blocks/"+parameter.vquery_blockId+"?peer="+ parameter.vquery_peer;
        window.alert(url);
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.send();
    };
    query3.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        url = "/channels/"+parameter.vquery_channelName+"/transactions/"+parameter.vquery_trxnId+"?peer="+parameter.vquery_peer;
        // window.alert(url);        
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.send();
    };
    query4.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        url = "/channels/"+parameter.vquery_channelName+"?peer="+parameter.vquery_peer;
        // window.alert(url);
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.send();
    };
    query5.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        url = "/chaincodes?peer="+parameter.vquery_peer+"&type="+parameter.vquery_type;
        // window.alert(url);
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.send();
    };
    query6.onclick=function(){
        var parameter = new Object();
        getQueryParameter(parameter);
        var xhr = new XMLHttpRequest();
        url = "channels?peer="+parameter.vquery_peer;
        // window.alert(url);
        xhr.open("GET",url, true);
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.setRequestHeader('authorization', ' Bearer '+ parameter.token);
        xhr.send();
    };
}