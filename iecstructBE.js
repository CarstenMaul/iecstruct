// Copyright (c) 2014 Håkon Nessjøen <haakon.nessjoen@gmail.com>

// Permission is hereby granted, free of charge, to any person obtaining a 
// copy of this software and associated documentation files (the "Software"), 
// to deal in the Software without restriction, including without limitation 
// the rights to use, copy, modify, merge, publish, distribute, sublicense, 
// and/or sell copies of the Software, and to permit persons to whom the 
// Software is furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in 
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR 
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, 
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE 
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER 
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, 
// ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER 
// DEALINGS IN THE SOFTWARE.

function iecstruct() {}
iecstructBE._VARIABLE = {
	prototype: {
		asObject: function (buffer, offset) {
			this.offset = arguments.length > 1 && typeof(arguments[1]) != 'undefined' ? arguments[1] : 0;
			if (arguments.length == 0) {
				if (typeof(this.buffer) == 'undefined') {
					this.buffer = new Buffer(this.bytelength);
					this.buffer.fill('\0');
				}
			} else {
				this.buffer = arguments[0];
			}
			return this._asObject();
		},
		fromObject: function (obj, buffer, offset) {
			this.offset = arguments.length > 2 && typeof(arguments[2]) != 'undefined' ? arguments[2] : 0;
			if (arguments.length <= 1) {
				if (typeof(this.buffer) == 'undefined') {
					this.buffer = new Buffer(this.bytelength);
					this.buffer.fill('\0');
				}
			} else {
				this.buffer = arguments[1];
			}
			this._fromObject(obj);
		}
	}
};

iecstructBE.STRUCT = function () {
	this.elements = [];
	this.elementNames = [];
	this.bytelength = 0;

	this._asObject = function () {
		var output = {};
		for (var i = 0; i < this.elementNames.length; ++i) {
			output[this.elementNames[i]] = this.elements[i].type.asObject(this.buffer, this.offset);
			this.offset += this.elements[i].bytelength;
		}
		return output;
	};
	this._fromObject = function (obj) {
		for (var i = 0; i < this.elementNames.length; ++i) {
			this.elements[i].type.fromObject(obj[this.elementNames[i]], this.buffer, this.offset);
			this.offset += this.elements[i].bytelength;
		}
	};
}
iecstructBE.STRUCT.prototype.addElement = function (name, type) {
	var element = {
		name: name,
		type: type
	};
	element.bytelength = type.bytelength;
	this.elements.push(element);
	this.elementNames.push(name);
	this.bytelength += element.bytelength;
	return this;
};

iecstructBE.STRUCT.prototype.addArray = function (name, type, length) {
	var element = {
		name: name,
		type: new iecstructBE.ARRAY(type, length),
	};
	element.bytelength = element.type.bytelength;
	this.elements.push(element);
	this.elementNames.push(name);
	this.bytelength += element.type.bytelength;
	return this;
};
iecstructBE.STRUCT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;

iecstructBE.ARRAY = function (type, length) {
	this.bytelength = length * type.bytelength;
	this._asObject = function () {
		var obj=[];
		for (var i = 0; i < length; ++i) {
			obj.push(type.asObject(this.buffer, this.offset));
			this.offset += type.bytelength;
		}
		return obj;
	};
	this._fromObject = function (obj) {
		if (typeof(obj) != 'object' || !('length' in obj)) {
			/* Should this emit some kind of "silent" warning? */
			//throw new Error('Expecting array input at buffer position ' + this.offset + ', while parsing object.');
			return;
		}
		var readlength = obj.length < length ? obj.length : length;
		for (var i = 0; i < readlength; ++i) {
			type.fromObject(obj[i], this.buffer, this.offset);
			this.offset += type.bytelength;
		}
	};
};
iecstructBE.ARRAY.prototype.__proto__ = iecstructBE._VARIABLE.prototype;

iecstructBE.STRING = function (length) {
	if (typeof(length) == 'undefined') {
		length = 80;
	}
	/* Null terminator */
	length++;

	this.bytelength = length;
	this._asObject = function () {
		var str = this.buffer.toString('utf8', this.offset, this.offset + this.bytelength);
		return str.replace(/\0.*/,'');
	};
	this._fromObject = function (obj) {
		obj = obj+""; /* ensure string */
		var stringlen = obj.length < length ? obj.length : length;
		this.buffer.write(obj, this.offset, this.bytelength, 'utf8');
		if (this.bytelength - stringlen > 0) {
			this.buffer.fill('\0', this.offset + stringlen, this.offset + (this.bytelength - stringlen));
		}
	};
};
iecstructBE.STRING.prototype.__proto__ = iecstructBE._VARIABLE.prototype;

/* untested */
iecstructBE.WSTRING = function (length) {
	if (typeof(length) == 'undefined') {
		length = 80;
	}
	/* Null terminator */
	length++;

	this.bytelength = length * 2;
	this._asObject = function () {
		var str = this.buffer.toString('utf16le', this.offset, this.offset + this.bytelength);
		return str.replace(/\0.*/,'');
	};
	this._fromObject = function (obj) {
		this.buffer.write(obj, this.offset, this.bytelength, 'utf16le');
		if (this.bytelength - obj.length > 0) {
			this.buffer.fill('\0', this.offset + (obj.length * 2), this.offset + (this.bytelength - (obj.length * 2)));
		}
	};
};
iecstructBE.WSTRING.prototype.__proto__ = iecstructBE._VARIABLE.prototype;

iecstructBE.ENUM = function () {
	this.enumlist={};
	this.lastval = -1;
	this.bytelength = 2;
	var enumlist = arguments.length > 0 ? arguments[0] : undefined;

	if (typeof enumlist != 'undefined' && typeof enumlist != 'object') {
		throw new Error("If specified, the first parameter must be a object of key value pairs containing name and numbers");
		return;
	}

	this.addValue = function (name) {
		var value = arguments.length > 1 ? arguments[1] : '';
		if (!(value+'').match(/^\d+$/)) {
			this.enumlist[name] = ++this.lastval;
		} else {
			this.enumlist[name] = value;
			this.lastval = value;
		}
		return this;
	};
	this._asObject = function () {
		var value = this.buffer.readUInt16LE(this.offset);
		for (var key in this.enumlist) {
			if (this.enumlist[key] === value) {
				return key;
			}
		}
		return value;
	};
	this._fromObject = function (obj) {
		var value;
		if (typeof(obj) == 'undefined') {
			obj = 0;
		}
		if (obj in this.enumlist) {
			value = this.enumlist[obj];
		} else if (!(obj+"").match(/^\d+$/)) {
			throw new Error("Invalid enum value: '" + obj + "' not in ENUM(" + Object.keys(this.enumlist).join(",") + ").");
		} else {
			value = obj;
		}
		this.buffer.writeUInt16LE(value, this.offset);
	};

	if (typeof enumlist == 'object') {
		for (var key in enumlist) {
			this.addValue(key, enumlist[key]);
		}
	}
};
iecstructBE.ENUM.prototype.__proto__ = iecstructBE._VARIABLE.prototype;

iecstructBE.miniENUM = function () {
	this.enumlist={};
	this.lastval = -1;
	this.bytelength = 1;
	var enumlist = arguments.length > 0 ? arguments[0] : undefined;

	if (typeof enumlist != 'undefined' && typeof enumlist != 'object') {
		throw new Error("If specified, the first parameter must be a object of key value pairs containing name and numbers");
		return;
	}

	this.addValue = function (name) {
		var value = arguments.length > 1 ? arguments[1] : '';
		if (!(value+'').match(/^\d+$/)) {
			this.enumlist[name] = ++this.lastval;
		} else {
			this.enumlist[name] = value;
			this.lastval = value;
		}
		return this;
	};
	this._asObject = function () {
		var value = this.buffer.readUInt8(this.offset);
		for (var key in this.enumlist) {
			if (this.enumlist[key] === value) {
				return key;
			}
		}
		return value;
	};
	this._fromObject = function (obj) {
		var value;
		if (typeof(obj) == 'undefined') {
			obj = 0;
		}
		if (obj in this.enumlist) {
			value = this.enumlist[obj];
		} else if (!(obj+"").match(/^\d+$/)) {
			throw new Error("Invalid enum value: '" + obj + "' not in miniENUM(" + Object.keys(this.enumlist).join(",") + ").");
		} else {
			value = obj;
		}
		this.buffer.writeUInt8(value, this.offset);
	};

	if (typeof enumlist == 'object') {
		for (var key in enumlist) {
			this.addValue(key, enumlist[key]);
		}
	}
};
iecstructBE.miniENUM.prototype.__proto__ = iecstructBE._VARIABLE.prototype;


iecstructBE._BOOL = function() {
	this.bytelength = 1;
	this._asObject = function () {
		return this.buffer.readUInt8(this.offset) != 0 ? true : false;
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt8(obj ? 1 : 0, this.offset);
	};
};
iecstructBE._BOOL.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.BOOL = new iecstructBE._BOOL();

iecstructBE._SINT = function() {
	this.bytelength = 1;
	this._asObject = function () {
		return this.buffer.readInt8(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeInt8(obj, this.offset);
	};
};
iecstructBE._SINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.SINT = new iecstructBE._SINT();

iecstructBE._USINT = function() {
	this.bytelength = 1;
	this._asObject = function () {
		return this.buffer.readUInt8(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt8(obj, this.offset);
	};
};
iecstructBE._USINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.BYTE = iecstructBE.USINT = new iecstructBE._USINT();

iecstructBE._INT = function() {
	this.bytelength = 2;
	this._asObject = function () {
		return this.buffer.readInt16BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeInt16BE(obj, this.offset);
	};
};
iecstructBE._INT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.INT = new iecstructBE._INT();

iecstructBE._UINT = function() {
	this.bytelength = 2;
	this._asObject = function () {
		return this.buffer.readUInt16BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt16BE(obj, this.offset);
	};
};
iecstructBE._UINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.WORD = iecstructBE.UINT = new iecstructBE._UINT();

iecstructBE._DINT = function() {
	this.bytelength = 4;
	this._asObject = function (buffer) {
		return this.buffer.readInt32BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeInt32BE(obj, this.offset);
	};
};
iecstructBE._DINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.DINT = new iecstructBE._DINT();

iecstructBE._UDINT = function() {
	this.bytelength = 4;
	this._asObject = function () {
		return this.buffer.readUInt32BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt32BE(obj, this.offset);
	};
};
iecstructBE._UDINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.DATE_AND_TIME = iecstructBE.DT = iecstructBE.DATE = iecstructBE.DWORD = iecstructBE.UDINT = new iecstructBE._UDINT();

iecstructBE._REAL = function() {
	this.bytelength = 4;
	this._asObject = function () {
		return this.buffer.readFloatBE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeFloatBE(obj, this.offset);
	};
};
iecstructBE._REAL.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.REAL = new iecstructBE._REAL();

iecstructBE._TIME = function () {
	this.bytelength = 4;
	this._asObject = function () {
		return this.buffer.readUInt32BE(this.offset) / 1000;
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt32BE(obj * 1000, this.offset);
	};
};
iecstructBE._TIME.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.TOD = iecstructBE.TIME_OF_DAY = iecstructBE.TIME = new iecstructBE._TIME();

iecstructBE._LINT = function() {
	this.bytelength = 8;
	this._asObject = function () {
		return this.buffer.readInt64BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeInt64BE(obj, this.offset);
	};
};
iecstructBE._LINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.LINT = new iecstructBE._LINT();

iecstructBE._ULINT = function() {
	this.bytelength = 8;
	this._asObject = function () {
		return this.buffer.readUInt64BE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeUInt64BE(obj, this.offset);
	};
};
iecstructBE._ULINT.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.LWORD = iecstructBE.ULINT = new iecstructBE._ULINT();

iecstructBE._LREAL = function() {
	this.bytelength = 8;
	this._asObject = function () {
		return this.buffer.readDoubleBE(this.offset);
	};
	this._fromObject = function (obj) {
		this.buffer.writeDoubleBE(obj, this.offset);
	};
};
iecstructBE._LREAL.prototype.__proto__ = iecstructBE._VARIABLE.prototype;
iecstructBE.LREAL = new iecstructBE._LREAL();

module.exports = exports = iecstructBE;
