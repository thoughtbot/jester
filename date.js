/* 
  Date parsing library, _____?
*/

// Zero-Fill
Number.prototype.zf || (Number.prototype.zf = function(l){ return this.toString().zf(l); });
String.prototype.zf || (String.prototype.zf = function(l){ return '0'.str(l - this.length) + this; });
String.prototype.str ||(String.prototype.str = function(l){
	var s = '', i = 0; while (i++ < l) { s += this; } return s;
});

// Replace leading zero(s) - i.e. 0004 = 4, 040 = 40
Number.prototype.rz || (Number.prototype.rz = function(){ return this.toString().rz(); });
String.prototype.rz || (String.prototype.rz = function(){
	var n = this, l = n.length, i = -1; 
	while( i++ < l ){ this.substring(i,i+1) == 0 ? 
		n = n.substring(1,n.length) : i = l; }
	return n;
});

Date.MONTH_NAMES = "January February March April May June July August September October November December".split(" ");	
Date.DAY_NAMES = "Sunday Monday Tuesday Wednesday Thursday Friday Saturday".split(" ");
Date.DAYS_PER_MONTH = "31 28 31 30 31 30 31 31 30 31 30 31".split(" ");
Date.FORMATS = {
	db: "%Y-%m-%d %H:%M:%S",
	rfc822: "%a, %d %b %Y %H:%M:%S %z",
	short: "%d %b %H:%M",
	long: "%B %d, %Y %H:%M"
};

// intervals for Date arithmetic
Date.EPOCH  = -1;
Date.ERA    = -2;
(function() {
	var d = Date;
	d["MILLISECOND"] = 1;
	d["SECOND"]      = 1000;
	d["MINUTE"]      = d["SECOND"] * 60;
	d["HOUR"]        = d["MINUTE"] * 60;
	d["DAY"]         = d["HOUR"] * 24;
	d["WEEK"]        = d["DAY"] * 7;
	d["MONTH"]       = d["DAY"] * 31;
	d["YEAR"]        = d["DAY"] * 365;
	d["DECADE"]      = d["YEAR"] * 10;
	d["CENTURY"]     = d["YEAR"] * 100;
	d["MILLENNIUM"]  = d["YEAR"] * 1000;
})();

Date.prototype.clone || (Date.prototype.clone = function(){
  return new Date(this.getTime());
});

Date.prototype.increment || (Date.prototype.increment = function(interval,times){
	this.setTime(this.getTime() + (
		(interval || Date.DAY) * (times || 1)));
	return this;
});

Date.prototype.decrement || (Date.prototype.decrement = function(interval,times){
	this.setTime(this.getTime() - (
		(interval || Date.DAY) * (times || 1)));
	return this;
});

Date.prototype.clearTime || (Date.prototype.clearTime = function(){
	this.setHours(0);
	this.setMinutes(0);
	this.setSeconds(0);
	this.setMilliseconds(0);
	return this;
});

Date.prototype.diff || (Date.prototype.diff = function(d,resolution){
	if(typeof d == 'string') d = Date.parse(d);
	return Math.floor((this.getTime()-d.getTime())/( resolution | Date.DAY )); 	
});
Date.prototype.compare || (Date.prototype.compare = Date.prototype.diff);

Date.prototype.getOrdinal || (Date.prototype.getOrdinal = function(){
	d = String(this); return d.substr(-(Math.min(d.length, 2))) > 3 
		&& d.substr(-(Math.min(d.length, 2))) < 21 ? "th" :
			["th", "st", "nd", "rd", "th"][Math.min(Number(d)%10, 4)];	
});

Date.prototype.getWeek || (Date.prototype.getWeek = function(){
	var f = (new Date(this.getFullYear(),0,1)).getDay();		
	return Math.round((this.getDayOfYear()+( f > 3 ? f - 4 : f + 3 ))/7);	
});

Date.prototype.getTimezone = function() {
    return this.toString().replace(
        /^.*? ([A-Z]{3}) [0-9]{4}.*$/, "$1").replace(
        /^.*?\(([A-Z])[a-z]+ ([A-Z])[a-z]+ ([A-Z])[a-z]+\)$/, "$1$2$3");
};

Date.prototype.getGMTOffset = function() {
    return (this.getTimezoneOffset() > 0 ? "-" : "+")
        + String.leftPad(Math.floor(this.getTimezoneOffset() / 60), 2, "0")
        + String.leftPad(this.getTimezoneOffset() % 60, 2, "0");
};

Date.prototype.getDayOfYear || (Date.prototype.getDayOfYear = function(){
	return (( Date.UTC(this.getFullYear(),this.getMonth(),this.getDate()+1,0,0,0) 
		- Date.UTC(this.getFullYear(),0,1,0,0,0) )/Date.DAY);
});

Date.prototype.lastDayOfMonth || (Date.prototype.lastDayOfMonth = function(){
	var td = this.clone();
	td.setMonth(td.getMonth()+1);
	td.setDate(0);
	return td.getDate();
});

Date.daysInMonth || (Date.daysInMonth = function(m, y) {
	m = (m + 12) % 12;
	if( Date.isLeapYear(y) && m == 1) return 29;
	return Date.Convensions.DAYS_IN_MONTH[m];
});

Date.isLeapYear || (Date.isLeapYear = function(y) {
	return (((y % 4)==0) && ((y % 100)!=0) || ((y % 400)==0));
});

Date.prototype.strftime || (Date.prototype.strftime = function(f){
    if ( !this.valueOf() ) return '&nbsp;';
    var d = this;
	
	// replace short-hand with actual format
	if( Date.FORMATS[f.toLowerCase()] ) f = Date.FORMATS[f.toLowerCase()];
	
	// ruby date formatting: http://dev.rubycentral.com/ref/ref_c_time.html#strftime
    return f.replace(/\%([aAbBcdHIjmMpSUWwxXyYOTZ])/g,
        function($1,$2){
            switch ($2){
				case 'a': return Date.parseDay(d.getDay()).substr(0, 3);
				case 'A': return Date.parseDay(d.getDay());
				case 'b': return Date.parseMonth(d.getMonth()).substr(0, 3);
				case 'B': return Date.parseMonth(d.getMonth());
				case 'c': return d.toString();
				case 'd': return d.getDate().zf(2);
				case 'H': return d.getHours().zf(2);
				case 'I': return ((h = d.getHours() % 12) ? h : 12).zf(2);
				case 'j': return d.getDayOfYear().zf(3);
				case 'm': return (d.getMonth() + 1).zf(2);				
				case 'M': return d.getMinutes().zf(2);				
				case 'p': return d.getHours() < 12 ? 'AM' : 'PM';				
				case 'S': return d.getSeconds().zf(2);
				case 'U': return d.getWeek().zf(2);				
				case 'W': throw Error("%W is not supported yet");
				case 'w': return d.getDay();
				case 'x': return d.format("%m/%d/%Y");				
				case 'X': return d.format("%I:%M%p");
				case 'y': return d.getFullYear().toString().substr(2);	
				case 'Y': return d.getFullYear();
				case 'O': return d.getGMTOffset();
				case 'T': return this.getTimezone();
				case 'Z': return this.getTimezoneOffset() * -60;
            }
        }
    );
});
Date.prototype.format || (Date.prototype.format = Date.prototype.strftime);

Date.__native_parse = Date.parse;
Date.parse = function(str){
	if( typeof str != 'string' ) return str;
	if( str.length == 0 || (/^\s+$/).test(str) ) return;
	for (var i = 0; i < Date.__PARSE_PATTERNS.length; i++) {
		var r = Date.__PARSE_PATTERNS[i].re.exec(str);
		if (r) return Date.__PARSE_PATTERNS[i].handler(r);	
	}
	return new Date(Date.__native_parse(str));	
};

Date.parseMonth || (Date.parseMonth = function(month){
	var index = -1;
	
	// a number was passed in
	if( typeof month == 'object' ){
		return Date.MONTH_NAMES[month.getMonth()];		
	}
	
	// a number was passed in
	else if( typeof month == 'number' ){
		index = month - 1;
		
		// check the index
		if (index < 0 || index > 11) 
			throw new Error("Invalid month index value must be between 1 and 12:" + index);
		
		return Date.MONTH_NAMES[index];
	}
	
	// or else it is a string
	var m = Date.MONTH_NAMES.findAll(function(name, i){
		if (new RegExp("^" + month, "i").test(name)){
			index = i; return true; 
		}
		return false;
	});
	if (m.length == 0) throw new Error("Invalid month string");
	if (m.length > 1) throw new Error("Ambiguous month");
	
	return Date.MONTH_NAMES[index];	
});

Date.parseDay || (Date.parseDay = function(day){
	// a number was passed in
	var index = -1;
	if( typeof day == 'number' ){
		index = day - 1;
		
		// check the index
		if (index < 0 || index > 6) 
			throw new Error("Invalid day index value must be between 1 and 7");
		return Date.DAY_NAMES[index];
	}
	
	var m = Date.DAY_NAMES.findAll(function(name, i){
		if (new RegExp("^" + day, "i").test(name)){
			index = i; return true; 
		}
		return false;
	});
	if (m.length == 0) throw new Error("Invalid day string");
	if (m.length > 1) throw new Error("Ambiguous day");
	
	return Date.DAY_NAMES[index];
});

Date.__PARSE_PATTERNS || (Date.__PARSE_PATTERNS = [
	// mm/dd/yyyy (American style)
	{   re: /(\d{1,2})\/(\d{1,2})\/(\d{2,4})/,
		handler: function(bits) {
			var d = new Date();
			d.setYear(bits[3]);
			d.setDate(parseInt(bits[2], 10));
			d.setMonth(parseInt(bits[1], 10) - 1); // Because months indexed from 0
			return d;
		}
	},	
	
	// yyyy-mm-ddTHH:MM (ISO style XML) 
	{   re: /(\d{4})-(\d{1,2})-(\d{1,2})T(\d{1,2}):(\d{1,2})/,
		handler: function(bits) {
			var d = new Date();
			d.setUTCFullYear(parseInt(bits[1]));
			d.setUTCDate(parseInt(bits[3], 10));
			d.setUTCMonth(parseInt(bits[2], 10) - 1);
			d.setUTCHours(parseInt(bits[4], 10));
			d.setUTCMinutes(parseInt(bits[5], 10));
			return d;
		}
	},
	
	// yyyy-mm-dd (ISO style)
	{   re: /(\d{4})-(\d{1,2})-(\d{1,2})/,
		handler: function(bits) {
			var d = new Date();
			d.setYear(parseInt(bits[1]));
			d.setDate(parseInt(bits[3], 10));
			d.setMonth(parseInt(bits[2], 10) - 1);
			return d;
		}
	},
	
	// Today
	{   re: /^tod/i,
		handler: function(){ return new Date(); } 
	},
	
	// Tomorrow
	{   re: /^tom/i,
		handler: function() {
			var d = new Date(); 
			d.setDate(d.getDate() + 1); 
			return d;
		}
	},
	
	// Yesterday
	{   re: /^yes/i,
		handler: function() {
			var d = new Date();
			d.setDate(d.getDate() - 1);
			return d;
		}
	},
	
	// 4th
	{   re: /^(\d{1,2})(st|nd|rd|th)?$/i, 
		handler: function(bits) {
			var d = new Date();
			d.setDate(parseInt(bits[1], 10));
			return d;
		}
	},
	
	// 4th Jan
	{   re: /^(\d{1,2})(?:st|nd|rd|th)? (\w+)$/i, 
		handler: function(bits) {
			var d = new Date();
			d.setDate(parseInt(bits[1], 10));
			d.setMonth(Date.parseMonth(bits[2]));
			return d;
		}
	},
	
	// 4th Jan 2003
	{   re: /^(\d{1,2})(?:st|nd|rd|th)? (\w+),? (\d{4})$/i,
		handler: function(bits) {
			var d = new Date();
			d.setDate(parseInt(bits[1], 10));
			d.setMonth(Date.parseMonth(bits[2]));
			d.setYear(bits[3]);
			return d;
		}
	},
	
	// Jan 4th
	{   re: /^(\w+) (\d{1,2})(?:st|nd|rd|th)?$/i, 
		handler: function(bits) {
			var d = new Date();
			d.setDate(parseInt(bits[2], 10));
			d.setMonth(Date.parseMonth(bits[1]));
			return d;
		}
	},
	
	// Jan 4th 2003
	{   re: /^(\w+) (\d{1,2})(?:st|nd|rd|th)?,? (\d{4})$/i,
		handler: function(bits) {
			var d = new Date();
			d.setDate(parseInt(bits[2], 10));
			d.setMonth(Date.parseMonth(bits[1]));
			d.setYear(bits[3]);
			return d;
		}
	},
	
	// next Tuesday - this is suspect due to weird meaning of "next"
	{   re: /^next (\w+)$/i,
		handler: function(bits) {
			var d = new Date();
			var day = d.getDay();
			var newDay = Date.parseDay(bits[1]);
			var addDays = newDay - day;
			if (newDay <= day) {
				addDays += 7;
			}
			d.setDate(d.getDate() + addDays);
			return d;
		}
	},
	
	// last Tuesday
	{   re: /^last (\w+)$/i,
		handler: function(bits) {
			throw new Error("Not yet implemented");
		}
	}
]);