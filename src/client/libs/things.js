function defer(){
	var deferred = {
		promise: null,
		resolve: null,
		reject: null
	};
	deferred.promise = new Promise(function(resolve, reject){
		deferred.resolve = resolve;
		deferred.reject = reject;
	});
	return deferred;
}
export function randKey(length, charset){
	var text = "";
	if (!length) length = 8;
	if (!charset) charset = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for( var i=0; i < length; i++ ){
    	text += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return text;
};

function joinPath(p1, p2){
	if (p1[p1.length-1] === '/') p1 = p1.substring(0,p1.length-1);
	if (p2[0] === '/') p2 = p2.substring(1);
	return p1+'/'+p2;
}

function isEquivalent(a, b){
	if (a === b) return true

	if (typeof a === typeof b){
		if (typeof a === 'object'){
			var aProps = Object.getOwnPropertyNames(a).sort();
			var bProps = Object.getOwnPropertyNames(b).sort();
			var eq = true;
			if (aProps.length === bProps.length){
				for (var i=0; i < aProps.length; i++){
					eq = eq && (aProps[i] === bProps[i]) && isEquivalent(a[aProps[i]], b[bProps[i]])
					if (!eq) break;
				}
				return eq;
			}
			else return false
		}
		else if (typeof a === 'function'){
			var aProps = Object.keys(a).sort();
			var bProps = Object.keys(b).sort();
			var eq = (a.toString() === b.toString());
			if (aProps.length === bProps.length){
				for (var i=0; i < aProps.length; i++){
					eq = eq && (aProps[i] === bProps[i]) && isEquivalent(a[aProps[i]], b[bProps[i]])
					if (!eq) break;
				}
				return eq;
			}
			else return false
		}
		else if (typeof a === 'number' || typeof a === 'string'){
			return (a === b)
		}
	}
	else return false
}

function EventEmitter(){
	this.__eventHandlers = {};
}
EventEmitter.prototype.emit = function(eventName, eventData){
	if (eventName in this.__eventHandlers){
		Object.values(this.__eventHandlers[eventName]).forEach(function(callback){
			callback(eventData);
		});
	}
}
EventEmitter.prototype.emitOnce = function(eventName, eventData){
	if (eventName in this.__eventHandlers){
		Object.values(this.__eventHandlers[eventName]).forEach(function(callback){
			callback(eventData);
		});
		delete this.__eventHandlers[eventName];
	}
}
EventEmitter.prototype.on = function(eventName, callback){
	if (!(eventName in this.__eventHandlers)) this.__eventHandlers[eventName] = {};
	var handler_id = randKey();
	this.__eventHandlers[eventName][handler_id] = callback;
	return handler_id;
}
EventEmitter.prototype.once = function(eventName, callback){
	var self = this;
	if (!(eventName in this.__eventHandlers)) this.__eventHandlers[eventName] = {};
	var handler_id = randKey();
	var wrapped = function(eventData){
		callback(eventData);
		delete self.__eventHandlers[eventName][handler_id];
	}
	this.__eventHandlers[eventName][handler_id] = wrapped;
	return handler_id;
}
EventEmitter.prototype.removeHandler = function(eventName, handler_id){
	return (handler_id in this.__eventHandlers[eventName]) && (delete this.__eventHandlers[eventName][handler_id]);
}

/* MqttWsClient */
export function MqttWsClient(endpoint, noInitialize, noRetryOnClose){
	EventEmitter.call(this);
	this.id = randKey();
	this.endpoint = endpoint;
	this.socket = undefined;
	
	this.subscriptions = {};
	
	this.noRetryOnClose = noRetryOnClose;
	this.$ready = false;
	
	if (!noInitialize) this.start();
}
MqttWsClient.prototype = new EventEmitter();
MqttWsClient.prototype.constructor = MqttWsClient;

MqttWsClient.prototype.start = function(){
	var self = this;
	var deferred = defer();
	self.$ready = deferred.promise;
	
	/* Initialize Websocket */
	self.socket = new WebSocket(self.endpoint);
	
	self.socket.onopen = function(){
		console.log("WebSocket to "+self.endpoint+" opened");
		self.emit('connect');
		deferred.resolve(true);
		for (var topic in self.subscriptions){
			self.socket.send(JSON.stringify({ action: 'subscribe', topic: topic }));
			console.log("Subscribed to "+topic+" at "+self.endpoint);
		}
	}
	self.socket.onclose = function(){
		console.log("WebSocket to "+self.endpoint+" closed");
		deferred.reject(false);
		if (!self.noRetryOnClose){
			setTimeout(function(){
				self.start();
			}, 5000);
		}
	};
	self.socket.onerror = function(){
		console.log("ERROR on WebSocket to "+self.endpoint+", retrying in 5 seconds");
//		setTimeout(function(){
//			self.start();
//		}, 5000);
	};
	self.socket.onmessage = function(event){
		var data = JSON.parse(event.data);
		// console.log('  -> '+data.topic, data.message);
		if (data.topic in self.subscriptions){
			Object.values(self.subscriptions[data.topic].handlers)
				.forEach(function(handler){
					handler(data.topic, data.message);
				});
			// self.subscriptions[data.topic].handler(data.topic, data.message);
			// self.subscriptions[data.topic].messages.push(data.message);
			// if (self.subscriptions[data.topic].messages.length > 200) self.subscriptions[data.topic].messages.shift();
		}
	};

	return deferred.promise;
}
MqttWsClient.prototype.close = function(){
	this.socket.close();
}
MqttWsClient.prototype.subscribe = function(topic, handler){
	if (!(topic in this.subscriptions)){
		this.subscriptions[topic] = {
			handlers: {},
			messages: []
		}
	}
	var handler_id = randKey();
	this.subscriptions[topic].handlers[handler_id] = handler;

	if (this.socket.readyState === WebSocket.OPEN){
		this.socket.send(JSON.stringify({ action: 'subscribe', topic: topic }));
		console.log("Subscribed to "+topic+" - handler "+handler_id);
	}
	else {
		console.log("WebSocket is closed, cannot subscribe to ["+topic+"]");
	}

	// else {
	// 	console.log("Already subscribed to topic ["+topic+"]");
	// }
	return handler_id;
}
MqttWsClient.prototype.unsubscribe = function(topic, handler_id){
	if ((topic in this.subscriptions)
		&& (handler_id in this.subscriptions[topic].handlers)){
		
		delete this.subscriptions[topic].handlers[handler_id];

		console.log("Unsubscribed from "+topic+" - handler "+handler_id);
		// delete this.subscriptions[topic];

		// if (this.socket.readyState === WebSocket.OPEN){
		// 	this.socket.send(JSON.stringify({ action: 'unsubscribe', topic: topic }));	
		// }
		// else {
		// 	console.log("WebSocket is closed, cannot unsubscribe from ["+topic+"]");
		// }
	}
	else {
		console.log("Already unsubscribed from topic ["+topic+"], cannot remove "+handler_id);
	}
}
MqttWsClient.prototype.publish = function(topic, message){
	if (this.socket.readyState === WebSocket.OPEN){
		this.socket.send(JSON.stringify({ action: 'publish', topic: topic, message: message }));
		console.log("Published "+topic, message)
	}
	else {
		console.log("WebSocket is closed, cannot publish to ["+topic+"]");
	}
}

/** Code Repository - an abstraction for the RESTful endpoint */
function FileSystem(base_url){
	EventEmitter.call(this);
	this.base_url = base_url;
}
FileSystem.prototype = new EventEmitter();
FileSystem.prototype.constructor = FileSystem;

FileSystem.prototype.get = function(abs_path){
	var self = this;
	return new Promise(function(resolve, reject){
		$.ajax(joinPath(self.base_url, abs_path))
			.done(function(data, status, xhr){
				if (data.type === 'directory'){
					data.dirs = [];
					data.files = [];
					Object.keys(data.content)
						.forEach(function(key){
							// console.log(data.content[key]);
							if (data.content[key].type === 'file') data.files.push(key);
							else if (data.content[key].type === 'directory') data.dirs.push(key);
							else console.log('Response from GFS server contains unexpected data');
						})
				}
				resolve(data);
			})
			.fail(function(xhr, status, error){
				console.log(status, error);
				reject(error);
			})
	})
}
/** 
 * @param {Object} file_data - File data
 * @param {string} file_data.name - Name of the file
 * @param {string} file_data.content - File content (utf-8 string)
 */
FileSystem.prototype.writeFile = function(abs_path, file_data){
	var self = this;
	return new Promise(function(resolve, reject){
		file_data.type = 'file';
		$.ajax({
			type: 'POST',
			url: joinPath(self.base_url, abs_path),
			data: JSON.stringify(file_data),
			contentType: 'application/json; charset=utf-8'
		})
		.done(function(data, status, xhr){
			console.log(status, data);
			resolve(data || {});
		})
		.fail(function(xhr, status, error){
			console.log(status, error);
			reject(error);
		})
	})
}
FileSystem.prototype.makeDir = function(abs_path, dir_name){
	var self = this;
	return new Promise(function(resolve, reject){
		var dir = {
			type: 'directory',
			name: dir_name
		}
		$.ajax({
			type: 'POST',
			url: joinPath(self.base_url, abs_path),
			data: JSON.stringify(dir),
			contentType: 'application/json; charset=utf-8'
		})
		.done(function(data, status, xhr){
			console.log(status, data);
			resolve(data || {});
		})
		.fail(function(xhr, status, error){
			console.log(status, error);
			reject(error);
		})
	})
}
FileSystem.prototype.delete = function(abs_path, ids){
	var self = this;
	return new Promise(function(resolve, reject){
		$.ajax({
			type: 'DELETE',
			url: joinPath(self.base_url, abs_path)+'?ids='+ids.join(',')
		})
		.done(function(data, status, xhr){
			console.log(status, data);
			resolve(data || {});
		})
		.fail(function(xhr, status, error){
			console.log(status, error);
			reject(error);
		})
	})
}

/** CodeEngine */
var ENGINE_ICONS = {
	'undefined': 'assets/img/device-unknown-sm.png',
	'raspberry-pi3': 'assets/img/device-raspberry-pi3-sm.png',
	'raspberry-pi0': 'assets/img/device-raspberry-pi0-sm.png',
	'xeon-e3': 'assets/img/device-xeon-e3-sm.png',
	'xeon-e5': 'assets/img/device-xeon-e5-sm.png'
}
function CodeEngine(pubsub, id, meta){
	EventEmitter.call(this);
	var self = this;
	this.pubsub = pubsub;
	this.id = id;
	this.meta = meta;

	this.status = "unknown";
	
	this.stats = [];
	this.console = [];

	this.codes = {};

	this._requests = {};
	this.pubsub.subscribe(this.pubsub.id+'/'+this.id, function(topic, message){
		if (message.reply_id in self._requests){
			self._requests[message.reply_id].resolve(message.payload);
			clearTimeout(self._requests[message.reply_id].timer);
			delete self._requests[message.reply_id];
		}
		else {
			console.log('[Engine:'+self.id+'] Received unexpected message');
			console.log(message);
		}
	});

	this.pubsub.subscribe(this.id+'/resource', function(topic, message){
		if (self.stats.length >= 100) self.stats.shift();
		self.stats.push(message);
		self.emit('resource-report', message);
		// self.emit('update');
	});
	this.pubsub.subscribe(this.id+'/console', function(topic, message){
		message.forEach(function(line){
			self.console.push(line);
		});
		self.emit('console-data', message);
		// self.emit('update');
	})
	console.log('Engine '+id+' connected');

	// Misc. operations
	if (meta.device) this.icon = ENGINE_ICONS[meta.device];
}
CodeEngine.prototype = new EventEmitter();
CodeEngine.prototype.constructor = CodeEngine;

CodeEngine.prototype.getProcesses = function(){
	return Object.keys(this.codes).reduce((list, name)=>{
		Object.keys(this.codes[name]).forEach((instance_id)=>{
			list.push({
				code_name: name,
				instance_id: instance_id,
				status: this.codes[name][instance_id]
			})
		})
		return list;
	}, []);
}

/** This method is called by the Dashboard object */
CodeEngine.prototype.update = function(data){
	var curState = {
		status: this.status,
		meta: this.meta,
		codes: this.codes
	};
	var newState = {
		status: data.status,
		meta: data.meta,
		codes: data.codes
	}

	this.status = data.status;
	this.meta = data.meta;
	this.codes = data.codes;

	if (!isEquivalent(curState, newState)) this.emit('status-change', {
		before: curState,
		now: newState
	});
}

CodeEngine.prototype.sendCommand = function(ctrl, kwargs){
	var self = this;
	var deferred = defer();
	var request_id = randKey(16);
	this._requests[request_id] = deferred;
	this.pubsub.publish(this.id+'/cmd', {
		request_id: request_id,
		reply_to: this.pubsub.id+'/'+this.id,
		ctrl: ctrl,
		kwargs: kwargs
	})
	deferred.timer = setTimeout(function(){
		if (request_id in self._requests){
			deferred.reject('PubsubCommandTimeout');
			delete self._requests[request_id];
		}
	}, 10000); // assume failure if reply not received
	return deferred.promise
}

CodeEngine.prototype.runCode = function(code_name, source){
	return this.sendCommand('run_code', {
			mode: 'raw',
			code_name: code_name,
			source: source
		})
}
// CodeEngine.prototype.pauseCode = function(code_name, instance_id){
// 	return this.sendCommand('pause_code', {
// 			code_name: code_name,
// 			instance_id: instance_id
// 		})
// }
// CodeEngine.prototype.resumeCode = function(code_name, instance_id){
// 	return this.sendCommand('resume_code', {
// 			code_name: code_name,
// 			instance_id: instance_id
// 		})
// }
CodeEngine.prototype.migrateCode = function(code_name, instance_id, target_engine){
	if (code_name && instance_id && target_engine){
		return this.sendCommand('migrate_code', {
			code_name: code_name,
			instance_id: instance_id,
			engine: target_engine
		})	
	}
	else return Promise.reject('Must supply all arguments to migrate');
}

/** Program */
function Program(pubsub, code_name, instance_id, source){
	EventEmitter.call(this);
	var self = this;
	this.pubsub = pubsub;
	this.code_name = code_name;
	this.id = instance_id;
	this.source = source;
	this.status = undefined;
	this.engine = undefined;
	this.meta = {};

	this.stats = [];
	this.console = [];
	this.snapshots = [];

	this._requests = {};
	this.pubsub.subscribe(this.pubsub.id+'/'+this.id, function(topic, message){
		console.log(message.reply_id, self._requests);
		if (message.reply_id in self._requests){
			self._requests[message.reply_id].resolve(message.payload);
			clearTimeout(self._requests[message.reply_id].timer);
			delete self._requests[message.reply_id];
		}
		else {
			console.log('[Program:'+self.code_name+'/'+self.id+'] Received unexpected message');
			console.log(message);
		}
	});

	this.pubsub.subscribe(this.code_name+'/'+this.id+'/resource', function(topic, message){
		if (self.stats.length >= 100) self.stats.shift();
		self.stats.push(message);
		// self.emit('update');
		self.emit('resource-report', message);
		// console.log(message);
	});
	this.pubsub.subscribe(this.code_name+'/'+this.id+'/console', function(topic, message){
		message.forEach(function(line){
			self.console.push(line);
		});
		// self.emit('update');
		self.emit('console-data', message);
		// console.log(message);
	});
	this.pubsub.subscribe(this.code_name+'/'+this.id+'/snapshots', function(topic, message){
		self.snapshots.push(message);
		self.emit('update');
		console.log(message);
	});
}
Program.prototype = new EventEmitter();
Program.prototype.constructor = Program;

/** This method is called by the Dashboard object */
Program.prototype.update = function(data, dashboard){
	var curStatus = this.status;
	this.engine = data.engine ? dashboard.engines[data.engine] : this.engine;
	this.status = data.status;
	this.meta = data.meta || this.meta;
	if (data.source) this.source = data.source;
	if (curStatus !== data.status) this.emit('status-change', {
		before: curStatus,
		now: this.status
	});
}

Program.prototype.sendCommand = function(ctrl, kwargs){
	var self = this;
	var deferred = defer();
	var request_id = randKey(16);
	self._requests[request_id] = deferred;
	self.pubsub.publish(self.code_name+'/'+self.id+'/cmd', {
		request_id: request_id,
		reply_to: self.pubsub.id+'/'+self.id,
		ctrl: ctrl,
		kwargs: kwargs
	})
	// deferred.timer = setTimeout(function(){
	// 	if (request_id in self._requests){
	// 		deferred.reject('PubsubCommandTimeout');
	// 		delete self._requests[request_id];
	// 	}
	// }, 10000); // assume failure if reply not received
	console.log(self._requests);
	return deferred.promise
}
Program.prototype.pause = function(){
	return this.sendCommand('pause')
}
Program.prototype.resume = function(){
	return this.sendCommand('resume')
}
Program.prototype.kill = function(){
	return this.sendCommand('kill')
}

Program.prototype.migrate = function(engine_id){
	if (this.engine){
		if (engine_id) return this.engine.migrateCode(this.code_name, this.id, engine_id);
		else return Promise.reject('No Target Engine provided for migration');
	}
	else return Promise.reject('No reference to Engine object to perform migration');
}

/** Dashboard */

export function Dashboard(config){
	if (!(this instanceof Dashboard)) return new Dashboard(config);
	EventEmitter.call(this);
	var self = this;
	this.config = Object.assign({
		pubsub_url: ('ws://'+window.location.hostname+':5000'),
		fs_url: (window.location.origin+'/fs'),
		topic_engine_registry: 'engine-registry',
		topic_program_monitor: 'program-monitor',
		topic_scheduler_namespace: 'things-scheduler'
	}, config);

	var pubsub = this.pubsub = new MqttWsClient(this.config.pubsub_url);
	var fs = this.fs = new FileSystem(this.config.fs_url);

	this.engines = {};
	this.programs = {};
	this.files = {};
	this.apps = {};
	this.history = [];

	this._requests = {};
	this.pubsub.subscribe(this.pubsub.id+'/dashboard', function(topic, message){
		if (message.reply_id in self._requests){
			self._requests[message.reply_id].resolve(message.payload);
			clearTimeout(self._requests[message.reply_id].timer);
			delete self._requests[message.reply_id];
		}
		else {
			console.log('[Dashboard] Received unexpected message');
			console.log(message);
		}
	});

	pubsub.subscribe(this.config.topic_engine_registry, function(topic, message){
		console.log(topic, message);
		if (!(message.id in self.engines)){
			self.engines[message.id] = new CodeEngine(pubsub, message.id, message.meta);
			self.engines[message.id].on('status-change', function(){
				// self.emit('update', self.engines[message.id]);
				self.emit('engine-registry-event', self.engines[message.id]);
			});

		}
		// else {
		// 	// Calling engine.update will cause it to emit the "status-change" event this dashboard is listening to
		// 	self.engines[message.id].update(message);
		// }
		
		// Calling engine.update will cause it to emit the "status-change" event this dashboard is listening to
		self.engines[message.id].update(message);

		// self.engines[message.id].status = message.status;
		// self.engines[message.id].meta = message.meta;
		// self.engines[message.id].codes = message.codes;
		// console.log(self.engines);
		// self.emit('update', self.engines[message.id]);

		// self.emit('engine-registry-event', self.engines[message.id]);
	});

	pubsub.subscribe(this.config.topic_program_monitor, function(topic, message){
		console.log(topic, message);
		if (!(message.instance_id in self.programs)){
			var program = new Program(pubsub, message.code_name, message.instance_id, message.source);
			program.on('status-change', function(){
				// self.emit('update');
				self.emit('program-monitor-event', program);
			})
			self.programs[message.instance_id] = program;
		}
		self.programs[message.instance_id].update(message, self);
		// self.programs[message.instance_id].engine = message.engine;
		// self.programs[message.instance_id].status = message.status;
		// self.programs[message.instance_id].meta = message.meta;
		// if (message.source) self.programs[message.instance_id].source = message.source;
		// self.emit('update');
	});

	pubsub.subscribe(this.config.topic_scheduler_namespace+'/events', function(topic, message){
		self.history.push(message);
		if (self.history.length > 1000) self.history.shift();
		self.emit('system-event', message);
	});

	pubsub.subscribe(this.config.topic_scheduler_namespace+'/state', function(topic, message){
		self.apps = message.apps;
		self.emit('system-state', message);
	});

	pubsub.on('connect', function(){
		setTimeout(function(){
			pubsub.publish(self.config.topic_engine_registry+'/bcast', { ctrl: 'report' });
			pubsub.publish(self.config.topic_program_monitor+'/bcast', { ctrl: 'report' });
			self.ackedPublish(self.config.topic_scheduler_namespace+'/cmd', 'report')
				.then(function(state){
					console.log("Scheduler returned its state", state);
					self.apps = state.apps;
					self.emit('system-state', state);
				})

			fs.get('/')
				.then(function(fsObject){
					// console.log(fsObject);
					self.files = fsObject;
					self.emit('filesystem-event', self.files);
				});

		}, 100);
	});
}
Dashboard.prototype = new EventEmitter();
Dashboard.prototype.constructor = Dashboard;

Dashboard.prototype.ackedPublish = function(topic, ctrl, kwargs){
	var self = this;
	var deferred = defer();
	var request_id = randKey(16);
	this._requests[request_id] = deferred;
	this.pubsub.publish(topic, {
		request_id: request_id,
		reply_to: this.pubsub.id+'/dashboard',
		ctrl: ctrl,
		kwargs: kwargs
	})
	deferred.timer = setTimeout(function(){
		if (request_id in self._requests){
			deferred.reject('PubsubCommandTimeout');
			delete self._requests[request_id];
		}
	}, 10000); // assume failure if reply not received
	return deferred.promise
};

Dashboard.prototype.runApplication = function(application){
	return this.ackedPublish(this.config.topic_scheduler_namespace+'/cmd', 'run_application', application)
};
Dashboard.prototype.pauseApplication = function(token){
	return this.ackedPublish(this.config.topic_scheduler_namespace+'/cmd', 'pause_application', { token: token })
};
Dashboard.prototype.resumeApplication = function(token){
	return this.ackedPublish(this.config.topic_scheduler_namespace+'/cmd', 'resume_application', { token: token })
};
Dashboard.prototype.killApplication = function(token){
	return this.ackedPublish(this.config.topic_scheduler_namespace+'/cmd', 'kill_application', { token: token })
};

Dashboard.prototype.connectReduxStore = function(redux_store){

	this.on('engine-registry-event', function(data){
		redux_store.dispatch({
			type: 'engine-registry-event',
			payload: { engine: data }
		})
	});

	this.on('program-monitor-event', function(data){
		redux_store.dispatch({
			type: 'program-monitor-event',
			payload: { program: data }
		})
	});

	this.on('filesystem-event', function(fs_root){
		redux_store.dispatch({
			type: 'filesystem-event',
			payload: fs_root
		})
	});

	this.on('system-event', function(event_data){
		redux_store.dispatch({
			type: 'system-event',
			payload: { event: event_data }
		})
	});

	this.on('system-state', function(event_data){
		redux_store.dispatch({
			type: 'system-state',
			payload: event_data
		})
	});

};

// export default {
// 	MqttWsClient: MqttWsClient,
// 	Dashboard: Dashboard
// }