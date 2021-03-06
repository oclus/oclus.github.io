'use strict';

function getJSON(url) {
    return new Promise(function(resolve, reject) {
        var xhr = new XMLHttpRequest();
        xhr.open('get', url, true);
        xhr.responseType = 'json';
        xhr.onload = function() {
            var status = xhr.status;
            if (status == 200) {
                resolve(xhr.response);
            } else {
                reject(status);
            }
        };
        xhr.send();
    });
}

getJSON('https://raw.githubusercontent.com/oclus/oclus.github.io/master/search/entries.json').then(function(data) {
    alert('Your Json result is:  ' + data.result);

    result.innerText = data.result;
}, function(status) {
    alert('Something went wrong.');
});