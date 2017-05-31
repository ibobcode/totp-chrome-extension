function errNotif(msg) {
  document.getElementById('errorMsg').innerHTML = msg;
  document.getElementById('errorMsg').style.visibility = 'visible';
  setTimeout(function(){ document.getElementById('errorMsg').style.visibility = 'hidden'; }, 3000);
}
function dec2hex(s) {
  return (s < 15.5 ? '0' : '') + Math.round(s).toString(16);
}

function hex2dec(s) {
  return parseInt(s, 16);
}
function isBase32(key) {
  var base32chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

  key = key.replace(/\s/g,'');
  key = key.toUpperCase();
  for (var i = 0; i < key.length; i++) {
    if (base32chars.indexOf(key[i]) == -1) {
      return null;
    }
  }
  if (key.length != 32) {
    return null;
  }
  return key;
}
function base32decode(strToDecode) {
  var base32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  var bits = "";
  var hex = "";
  for (var i = 0; i < strToDecode.length; i++) {
      var val = base32.indexOf(strToDecode.charAt(i));
      bits += padding(val.toString(2), 5);
  }
  for (var i = 0; i+4 <= bits.length; i+=4) {
      var chunk = bits.substr(i, 4);
      hex = hex + parseInt(chunk, 2).toString(16) ;
  }
  return hex;
}

function padding(str, len) {
  if (len + 1 >= str.length) {
      str = Array(len + 1 - str.length).join('0') + str;
  }
  return str;
}

function OTP(original_secret) {
  var secret = base32decode(original_secret);
  var epoch = Math.round(new Date().getTime() / 1000.0);
  var input = padding(dec2hex(Math.floor(epoch / 30)), 16);
  var shaObj = new jsSHA("SHA-1", "HEX");
  shaObj.setHMACKey(secret, "HEX");
  shaObj.update(input);
  var hmac = shaObj.getHMAC("HEX");
  var last_byte = hex2dec(hmac.substring(hmac.length - 1));
  var four_bytes = (hex2dec(hmac.substr(last_byte * 2, 8)) & 0x7fffffff) + '';
  otp = four_bytes.substr(four_bytes.length - 6, 6).toString();
  var p1 = otp.substring(0, 3);
  var p2 = otp.substring(3);
  document.getElementById('totpa').innerHTML = p1;
  document.getElementById('totpb').innerHTML = p2;
}

function loop()
{
  var epoch = Math.round(new Date().getTime() / 1000.0);
  var progressVal = Math.trunc(((epoch % 30) * 100) / 30);
  document.getElementById("myBar").style.width = progressVal + '%';
  if (progressVal > 90) document.getElementById("myBar").style.backgroundColor = '#EA4335';
  else if (progressVal > 70) document.getElementById("myBar").style.backgroundColor = '#FBBC05';
  else document.getElementById("myBar").style.backgroundColor = '#63bf63';
  if (epoch % 30 == 0) generateOTP('totp');
  var tab = chrome.tabs.getSelected(null, function (tab) {
    if (tab.url.indexOf('totp') != -1) {
      document.getElementById('injection').style.visibility = 'visible';
    }
  })
}

function updateSelect(name) {
  var select = document.getElementById('chooseProfile');
  var opt = document.createElement('option');
  opt.innerHTML = name;
  opt.value = name;
  select.appendChild(opt);
}

function generateOTP(type) {
  var select = document.getElementById('chooseProfile');
  if (select.options[select.selectedIndex] != undefined)
  {
    document.getElementById('myProgress').style.visibility = 'visible';
    var label = select.options[select.selectedIndex].text;
    chrome.storage.local.get({'requireis': []}, function (result) {
      var requireis = result.requireis;
      for(var i = 0; i < requireis.length; i++){
        if (requireis[i].name === label) {
          if (type === 'totp') {
            OTP(requireis[i].key);
          }
        }
      }
    });
  }
  else {
    document.getElementById('myProgress').style.visibility = 'hidden';
    document.getElementById('totpa').innerHTML = "---";
    document.getElementById('totpb').innerHTML = "---";
  }
}

function addUser() {
  chrome.storage.local.get({'requireis': []}, function (result) {
    var requireis = result.requireis;
    for (var i = 0; i < requireis.length; i++) {
      if (requireis[i].name == document.getElementById('username').value) {
        errNotif('User name aleready used');
        return ;
      }
    }
    var key = isBase32(document.getElementById('userkey').value);
    if (key == null) {
      errNotif('Wrong key format');
      return ;
    }
    requireis.push({'name': document.getElementById('username').value, 'key': key});
    chrome.storage.local.set({'requireis': requireis}, function () {
      updateSelect(document.getElementById('username').value);
      selectChange();
      document.getElementById('username').value = "";
      document.getElementById('userkey').value = "";
    });
  });
}

function delUser() {
  var select = document.getElementById('chooseProfile');
  var label = select.options[select.selectedIndex].text;
  chrome.storage.local.get({'requireis': []}, function (result) {
    var requireis = result.requireis;
    for(var i = 0; i < requireis.length; i++){
    	if (requireis[i].name === label) requireis.splice(i, 1);
    }
    chrome.storage.local.set({'requireis': requireis}, function () {
      for(var i = 0; i < select.options.length; i++){
      	if (select.options[i].text === label) select.options[i].remove();
      }
      selectChange();
    });
  });
}

function selectChange() {
  generateOTP('totp');
}

function injectCode() {
  var otp = document.getElementById('totpa').innerHTML + document.getElementById('totpb').innerHTML;
  chrome.tabs.getSelected(null, function(tab) {
    var id = tab.id;
    chrome.tabs.executeScript(id, {
      code: 'document.getElementById("totpPin").value = ' + otp + '; document.getElementById("submit").click();'
    });
  });
}

document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('errorMsg').style.visibility = 'hidden';
  document.getElementById('injection').style.visibility = 'hidden';
  var select = document.getElementById('chooseProfile');
  chrome.storage.local.get({'requireis': []}, function (result) {
    var requireis = result.requireis;
    for(var i = 0; i < requireis.length; i++) {
      var opt = document.createElement('option');
      opt.innerHTML = requireis[i].name;
      opt.value = requireis[i].name;
      select.appendChild(opt);
    }
    document.getElementById('adduser').addEventListener("click", addUser);
    document.getElementById('deluser').addEventListener("click", delUser);
    document.getElementById('injection').addEventListener("click", injectCode);
    document.getElementById('chooseProfile').addEventListener("change", selectChange);
    generateOTP('totp');
    setInterval(loop, 500);
  });
});
