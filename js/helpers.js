var obj_merge = function(){
    var return_obj = {};
    var inputs = Array.prototype.slice.call(arguments);
    for(var i = 0; i < inputs.length; i++) {
    	var obj = inputs[i];
    	for (var attrname in obj) { return_obj[attrname] = obj[attrname]; }
    }
    return return_obj;
}

var Request = {
	param: function(object) {
	    var encodedString = '';
	    for (var prop in object) {
	        if (object.hasOwnProperty(prop)) {
	            if (encodedString.length > 0) {
	                encodedString += '&';
	            }
	            encodedString += encodeURI(prop + '=' + object[prop]);
	        }
	    }
	    return encodedString;
	},

	post: function(url, data = null, success_cb = function() {}, failure_cb = function() {}) {
		var xhr = new XMLHttpRequest();
		
		xhr.open('POST', url );
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded');

		if( data ) {
			data = encodeURI(Request.param(data));
		}

		xhr.onload = function() {
		    if(xhr.status === 200) {
		        success_cb(xhr);
		    } else if (xhr.status !== 200) {
		        failure_cb(xhr);
		    }
		};

		xhr.send(data);
	}
}