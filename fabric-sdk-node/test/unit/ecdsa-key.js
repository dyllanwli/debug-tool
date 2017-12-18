/**
 * Copyright 2016-2017 IBM All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the 'License');
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an 'AS IS' BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

'use strict';

var tape = require('tape');
var _test = require('tape-promise');
var test = _test(tape);

var testutil = require('./util.js');
var utils = require('fabric-client/lib/utils.js');
var ecdsaKey = require('fabric-client/lib/impl/ecdsa/key.js');

var jsrsa = require('jsrsasign');
var KEYUTIL = jsrsa.KEYUTIL;
var asn1 = jsrsa.asn1;

test('\n\n ** ECDSA Key Impl tests **\n\n', function (t) {
	testutil.resetDefaults();

	t.throws(
		function () {
			var k = new ecdsaKey();
		},
		/^Error: The key parameter is required by this key class implementation, whether this instance is for the public key or private key/,
		'ECDSA Impl test: catch missing key param'
	);

	t.throws(
		function () {
			var k = new ecdsaKey('dummy private key');
		},
		/^Error: This key implementation only supports keys generated by jsrsasign.KEYUTIL. It must have a "type" property of value "EC"/,
		'ECDSA Impl test: catch missing key type of "EC"'
	);

	t.throws(
		function () {
			var k = new ecdsaKey({type: 'RSA'});
		},
		/^Error: This key implementation only supports keys generated by jsrsasign.KEYUTIL. It must have a "type" property of value "EC"/,
		'ECDSA Impl test: catch invalid key type'
	);

	t.throws(
		function () {
			var k = new ecdsaKey({type: 'EC', pubKeyHex: 'some random value'});
		},
		/^Error: This key implementation only supports keys generated by jsrsasign.KEYUTIL. It must have a "prvKeyHex" property/,
		'ECDSA Impl test: catch missing "prvKeyHex"'
	);

	t.throws(
		function () {
			var k = new ecdsaKey({type: 'EC', prvKeyHex: null});
		},
		/^Error: This key implementation only supports keys generated by jsrsasign.KEYUTIL. It must have a "pubKeyHex" property/,
		'ECDSA Impl test: catch missing "pubKeyHex" property'
	);

	t.throws(
		function () {
			var k = new ecdsaKey({type: 'EC', prvKeyHex: null, pubKeyHex: null});
		},
		/^Error: This key implementation only supports keys generated by jsrsasign.KEYUTIL. It must have a "pubKeyHex" property/,
		'ECDSA Impl test: catch "pubKeyHex" with null value'
	);


	t.doesNotThrow(
		function () {
			var k = new ecdsaKey({type: 'EC', prvKeyHex: null, pubKeyHex: 'some random value'});
		},
		null,
		'ECDSA Impl test: test a valid key'
	);

	// test private keys
	var pair1 = KEYUTIL.generateKeypair('EC', 'secp256r1');
	var key1 = new ecdsaKey(pair1.prvKeyObj);
	t.equal(key1.getSKI().length, 64, 'Checking generated SKI hash string for 256 curve keys');

	t.doesNotThrow(
		function () {
			key1.toBytes();
		},
		null,
		'Checking that a private key instance allows toBytes()'
	);

	var pair2 = KEYUTIL.generateKeypair('EC', 'secp384r1');
	var key2 = new ecdsaKey(pair2.prvKeyObj);
	t.equal(key2.getSKI().length, 64, 'Checking generated SKI hash string for 384 curve keys');

	t.equal(key1.isSymmetric() || key2.isSymmetric(), false, 'Checking if key is symmetric');
	t.equal(key1.isPrivate() && key2.isPrivate(), true, 'Checking if key is private');

	t.equal(key1.getPublicKey().isPrivate(), false, 'Checking isPrivate() logic');
	t.equal(key1.getPublicKey().toBytes().length, 182, 'Checking toBytes() output');

	// test public keys
	var key3 = new ecdsaKey(pair1.pubKeyObj);
	t.equal(key3.getSKI().length, 64, 'Checking generated SKI hash string for 256 curve public key');

	t.doesNotThrow(
		function() {
			key3.toBytes();
		},
		null,
		'Checking to dump a public ECDSAKey object to bytes'
	);

	var key4 = new ecdsaKey(pair2.pubKeyObj);
	t.equal(key4.getSKI().length, 64, 'Checking generated SKI hash string for 384 curve public key');

	t.doesNotThrow(
		function() {
			key4.toBytes();
		},
		null,
		'Checking to dump a public ECDSAKey object to bytes'
	);

	t.equal(!key3.isPrivate() && !key4.isPrivate(), true, 'Checking if both keys are public');
	t.equal(key3.getPublicKey().isPrivate(), false, 'Checking getPublicKey() logic');
	t.equal(key4.getPublicKey().toBytes().length, 220, 'Checking toBytes() output');

	//test CSR generation
	var pair3 = KEYUTIL.generateKeypair('EC', 'secp256r1');
	var key3 = new ecdsaKey(pair3.prvKeyObj);
	var key4 = new ecdsaKey(pair3.pubKeyObj);

	t.throws(
		function () {
			key4.generateCSR('CN=publickey');
		},
		/A CSR cannot be generated from a public key/,
		'Checking that a CSR cannot be generated from a public key'
	);

	//malformed subjectDN
	try {
		var csrPEM = key3.generateCSR('###############');
		t.fail('Should not have generated a CSR with a malformed subject');
	}
	catch (err) {
		t.pass('Checking that CSR is not generated for a malformed subject');
	};

	//valid CSR tests
	var csrObject;
	var subjectDN = 'CN=dummy';
	try {
		var csrPEM = key3.generateCSR(subjectDN);
		csrObject = asn1.csr.CSRUtil.getInfo(csrPEM);
	}
	catch (err) {
		t.fail('Failed to generate a CSR: ' + err.stack ? err.stack : err);
	};

	t.equal(asn1.x509.X500Name.onelineToLDAP(csrObject.subject.name), subjectDN,
		'Checking CSR subject matches subject from request');

	t.equal(csrObject.pubkey.obj.pubKeyHex, key3.getPublicKey()._key.pubKeyHex,
		'Checking CSR public key matches requested public key');

	t.end();
});
