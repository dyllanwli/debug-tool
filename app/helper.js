var log4js = require('log4js');
var logger = log4js.getLogger('Helper');
logger.setLevel('DEBUG');

var path = require('path');
var util = require('util');
var fs = require('fs-extra');
var User = require('fabric-client/lib/User.js');
var crypto = require('crypto');
var config = require("../config.json");
var FabricCAService = require('fabric-ca-client');

var hfc = require('fabric-client');
hfc.addConfigFile(path.join(__dirname, 'network-config.json'));
hfc.setLogger(logger);
var ORGS = hfc.getConfigSetting('network-config');
hfc.setConfigSetting('request-timeout', 60000);
var clients = {};
var channels = {};
var caClients = {};

// set up the client and channel objects for each org
for (let key in ORGS) {
	if (key.indexOf('org') === 0) {
		let client = new hfc();

		let cryptoSuite = hfc.newCryptoSuite();
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({
			path: getKeyStoreForOrg(ORGS[key].name)
		}));
		client.setCryptoSuite(cryptoSuite);
		channels[key] = {};
		for (let index in config.channelsList) {
			let channelName = config.channelsList[index];
			let channel = client.newChannel(channelName);
			// 添加所有的orderer
			newOrderer(client, channel)
			clients[key] = client;
			channels[key][channelName] = channel;

			setupPeers(channel, key, client);
		}
		let caUrl = ORGS[key].ca;
		caClients[key] = new FabricCAService(caUrl, null /*defautl TLS opts*/ , '' /* default CA */ , cryptoSuite);
	}
}
logger.debug("=======client and channel setted up======")

function setupPeers(channel, org, client) {
	for (let key in ORGS[org].peers) {
		let data = fs.readFileSync(path.join(__dirname, ORGS[org].peers[key]['tls_cacerts']));
		let peer = client.newPeer(
			ORGS[org].peers[key].requests, {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[org].peers[key]['server-hostname']
			}
		);
		peer.setName(key);


		channel.addPeer(peer);
	}
}

function newOrderer(client, channel) {
	for (let index in ORGS['orderer']) {
		let newOrderer
		let data = fs.readFileSync(path.join(__dirname, ORGS.orderer[index]['tls_cacerts']));
		newOrderer = client.newOrderer(
			ORGS.orderer[index].url, {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS.orderer[index]['server-hostname']
			}
		);
		channel.addOrderer(newOrderer);
	}
}

function readAllFiles(dir) {
	var files = fs.readdirSync(dir);
	var certs = [];
	files.forEach((file_name) => {
		let file_path = path.join(dir, file_name);
		let data = fs.readFileSync(file_path);
		certs.push(data);
	});
	return certs;
}

function getOrgName(org) {
	return ORGS[org].name;
}

function getKeyStoreForOrg(org) {
	return hfc.getConfigSetting('keyValueStore') + '_' + org;
}

function newRemotes(names, forPeers, userOrg, channelName) {
	let client = getClientForOrg(userOrg);

	let targets = [];
	// find the peer that match the names
	for (let idx in names) {
		let peerName = names[idx];
		if (ORGS[userOrg].peers[peerName]) {
			// found a peer matching the name
			let data = fs.readFileSync(path.join(__dirname, ORGS[userOrg].peers[peerName]['tls_cacerts']));
			let grpcOpts = {
				pem: Buffer.from(data).toString(),
				'ssl-target-name-override': ORGS[userOrg].peers[peerName]['server-hostname']
			};

			if (forPeers) {
				targets.push(client.newPeer(ORGS[userOrg].peers[peerName].requests, grpcOpts));
			} else {
				let eh = client.newEventHub();
				eh.setPeerAddr(ORGS[userOrg].peers[peerName].events, grpcOpts);
				targets.push(eh);
			}
		}
	}

	if (targets.length === 0) {
		logger.error(util.format('Failed to find peers matching the names %s', names));
	}

	return targets;
}



// 其他api调用的函数
var getChannelForOrg = function (org, channelName) {
	// 默认为第一个channel
	if (channelName == undefined) {
		channelName = config.channelsList[0];
	}
	return channels[org][channelName];
};

var getClientForOrg = function (org) {
	return clients[org];
};

var newPeers = function (names, org, channelName) {
	// channelName is not use.
	return newRemotes(names, true, org, channelName);
};

var newEventHubs = function (names, org, channelName) {
	return newRemotes(names, false, org, channelName);
};

var getMspID = function (org) {
	logger.debug('Msp ID : ' + ORGS[org].mspid);
	return ORGS[org].mspid;
};

var getAdminUser = function (userOrg) {
	var users = hfc.getConfigSetting('admins');
	var username = users[0].username;
	var password = users[0].secret;
	var member;
	var client = getClientForOrg(userOrg);

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				// need to enroll it with CA server
				return caClient.enroll({
					enrollmentID: username,
					enrollmentSecret: password
				}).then((enrollment) => {
					logger.info('Successfully enrolled user \'' + username + '\'');
					member = new User(username);
					member.setCryptoSuite(client.getCryptoSuite());
					return member.setEnrollment(enrollment.key, enrollment.certificate, getMspID(userOrg));
				}).then(() => {
					return client.setUserContext(member);
				}).then(() => {
					return member;
				}).catch((err) => {
					logger.error('Failed to enroll and persist user. Error: ' + err.stack ?
						err.stack : err);
					return null;
				});
			}
		});
	});
};

// regiser user
var getRegisteredUsers = function (username, userOrg, isJson) {
	var member;
	var client = getClientForOrg(userOrg);
	var enrollmentSecret = null;
	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);
		// clearing the user context before switching
		client._userContext = null;
		return client.getUserContext(username, true).then((user) => {
			if (user && user.isEnrolled()) {
				logger.info('Successfully loaded member from persistence');
				return user;
			} else {
				let caClient = caClients[userOrg];
				return getAdminUser(userOrg).then(function (adminUserObj) {
					member = adminUserObj;
					return caClient.register({
						enrollmentID: username,
						affiliation: userOrg + '.department1'
					}, member);
				}).then((secret) => {
					enrollmentSecret = secret;
					logger.debug(username + ' registered successfully');
					return caClient.enroll({
						enrollmentID: username,
						enrollmentSecret: secret
					});
				}, (err) => {
					logger.debug(username + ' failed to register');
					return '' + err;
					//return 'Failed to register '+username+'. Error: ' + err.stack ? err.stack : err;
				}).then((message) => {
					if (message && typeof message === 'string' && message.includes(
							'Error:')) {
						logger.error(username + ' enrollment failed');
						return message;
					}
					logger.debug(username + ' enrolled successfully');

					member = new User(username);
					member._enrollmentSecret = enrollmentSecret;
					return member.setEnrollment(message.key, message.certificate, getMspID(userOrg));
				}).then(() => {
					client.setUserContext(member);
					return member;
				}, (err) => {
					logger.error(util.format('%s enroll failed: %s', username, err.stack ? err.stack : err));
					return '' + err;
				});;
			}
		});
	}).then((user) => {
		if (isJson && isJson === true) {
			var response = {
				success: true,
				secret: user._enrollmentSecret,
				message: username + ' enrolled Successfully',
			};
			return response;
		}
		return user;
	}, (err) => {
		logger.error(util.format('Failed to get registered user: %s, error: %s', username, err.stack ? err.stack : err));
		return '' + err;
	});
};

// register admin
var getOrgAdmin = function (userOrg) {
	var admin = ORGS[userOrg].admin;
	var keyPath = path.join(__dirname, admin.key);
	var keyPEM = Buffer.from(readAllFiles(keyPath)[0]).toString();
	var certPath = path.join(__dirname, admin.cert);
	var certPEM = readAllFiles(certPath)[0].toString();

	var client = getClientForOrg(userOrg);
	var cryptoSuite = hfc.newCryptoSuite();
	if (userOrg) {
		cryptoSuite.setCryptoKeyStore(hfc.newCryptoKeyStore({
			path: getKeyStoreForOrg(getOrgName(userOrg))
		}));
		client.setCryptoSuite(cryptoSuite);
	}

	return hfc.newDefaultKeyValueStore({
		path: getKeyStoreForOrg(getOrgName(userOrg))
	}).then((store) => {
		client.setStateStore(store);

		return client.createUser({
			username: 'peer' + userOrg + 'Admin',
			mspid: getMspID(userOrg),
			cryptoContent: {
				privateKeyPEM: keyPEM,
				signedCertPEM: certPEM
			}
		});
	});
};

var setupChaincodeDeploy = function () {
	// process.env.GOPATH = path.join(__dirname, config.CC_GOPATH);
	process.env.GOPATH = path.join(__dirname, hfc.getConfigSetting("CC_GOPATH"));
};

var getLogger = function (moduleName) {
	var logger = log4js.getLogger(moduleName);
	logger.setLevel('DEBUG');
	return logger;
};

var getPeerAddressByName = function (org, peer) {
	var address = ORGS[org].peers[peer].requests;
	return address.split('grpcs://')[1];
};

var getOrgs = function () {
	let orgList = []
	for (let key in ORGS) {
		if (key.indexOf('org') === 0) {
			orgList.push(key)
		}
	}
	return orgList
}

var getPeersByOrg = function (org) {
	let peerList = []
	for (let peerName in ORGS[org].peers) {
		peerList.push(ORGS[org].peers[peerName]);
	}
	return peerList;
};

var getEndorsementpolicy = function (ep, org) {
	ep.identities.push({
		role: {
			name: 'admin',
			mspId: ORGS[org].mspid
		}
	})
	ep.identities.push({
		role: {
			name: 'member',
			mspId: ORGS[org].mspid
		}
	})
	ep.policy['1-of'] = []
	ep.policy['1-of'].push({
		'signed-by': 2
	})
	ep.policy['1-of'].push({
		'2-of': [{
			'signed-by': 0
		}, {
			'signed-by': 1
		}]
	})
	return ep
}

exports.getChannelForOrg = getChannelForOrg;
exports.getClientForOrg = getClientForOrg;
exports.getLogger = getLogger;
exports.setupChaincodeDeploy = setupChaincodeDeploy;
exports.getMspID = getMspID;
exports.ORGS = ORGS;
exports.newPeers = newPeers;
exports.newEventHubs = newEventHubs;
exports.getPeerAddressByName = getPeerAddressByName;
exports.getRegisteredUsers = getRegisteredUsers;
exports.getOrgAdmin = getOrgAdmin;
exports.getAdminUser = getAdminUser;
exports.getOrgs = getOrgs;
exports.getPeersByOrg = getPeersByOrg;
exports.getEndorsementpolicy = getEndorsementpolicy