// ==UserScript==
// @name         kemono.party图片下载器
// @name:en      kemono.party Downloader
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  Download kemono.party Images.
// @description:en  Download kemono.party Images.
// @author       endedge
// @match        https://kemono.party/*
// @match        https://kemono.su/*
// @match        https://kemono.cr/*
// @match        https://pawchive.st/*
// @icon         https://kemono.party/favicon.ico
// @connect      file.pawchive.st
// @grant        GM_xmlhttpRequest
// @grant        GM_getValue
// @grant        GM_setValue
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.2.0/jszip.min.js
// ==/UserScript==

(function () {
    var dlList = [];
    var zip;
    var totalImage = -1;
    var addFile = (name, content) => zip.file(name, content);

    var checkbox = document.createElement('input');
    checkbox.type = "checkbox";
    checkbox.id = "needFirstImageCheckbox";

    var checkboxLabel = document.createElement('label')
    checkboxLabel.htmlFor = "needFirstImageCheckbox";
    checkboxLabel.appendChild(document.createTextNode('Need First Image'));

    var span = document.createElement("span");
    span.textContent = "Download Pictures";

    var spanZip = document.createElement("span");
    spanZip.textContent = "Download ZIP";

    var modifiedPicName = document.createElement("modifiedNames");
    modifiedPicName.textContent = "Modified Names";

    var button = document.createElement("button");
    button.classList.add("post__download");
    button.type = "button";
    button.appendChild(span);

    button.onclick = function () {
        var imgs = getImageLinks();
        downloadImages(...imgs);
    }

    var buttonZip = document.createElement("button");
    buttonZip.classList.add("zip__download");
    buttonZip.type = "button";
    buttonZip.appendChild(spanZip);

    buttonZip.onclick = function () {
        zip = new JSZip();
        var imgs = getImageLinks();
        downloadImages_ZIP(...imgs);
    }

    var buttonModifiedPicName = document.createElement("button");
    buttonModifiedPicName.classList.add("modified_name");
    buttonModifiedPicName.type = "button";
    buttonModifiedPicName.appendChild(modifiedPicName);
    buttonModifiedPicName.onclick = function () {
        modifiedNames();
    }

    function appendButtons() {
        var p = document.getElementsByClassName("post__actions")[0];
        if (p && !p.querySelector(".post__download")) {
            p.appendChild(button);
            p.appendChild(buttonZip);
            p.appendChild(buttonModifiedPicName);
            p.appendChild(checkbox);
            p.appendChild(checkboxLabel);
            return true;
        }
        return false;
    }

    if (!appendButtons()) {
        var observer = new MutationObserver(function () {
            if (appendButtons()) {
                observer.disconnect();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    //var p = document.getElementsByClassName("post__actions")[0];
    //p.appendChild(button);
    //p.appendChild(buttonZip);
    //p.appendChild(checkbox);
    //p.appendChild(checkboxLabel);

    function downloadImages(...urls) {
        var name = document.getElementsByClassName("post__title")[0].getElementsByTagName("span")[0].textContent;
        var index = 0;
        urls.forEach(function (url) {
            forceDownload(url, name + "_" + index + "." + url.split(".")[url.split(".").length - 1], false);
            index++;
        });
        return undefined;
    }

    function downloadImages_ZIP(...urls) {
        var index = 0;
        var name = document.getElementsByClassName("post__title")[0].getElementsByTagName("span")[0].textContent;
        totalImage = urls.length;
        urls.forEach(function (url) {
            forceDownload(url, name + "_" + index + "." + url.split(".")[url.split(".").length - 1], true);
            index++;
        });
        return undefined;
    }

    function forceDownload(url, fileName, zipFlag) {
        forceDownloadWithRetry(url, fileName, zipFlag, 0);
    }

    function forceDownloadWithRetry(url, fileName, zipFlag, count) {
        if (dlList.includes(fileName)) {
            return;
        }
        GM_xmlhttpRequest({
            method: "GET",
            url: url,
            binary: true,
            responseType: "blob",
            onload: function (response) {
                console.log("[Downloader.js] Downloaded " + fileName);
                if (response.response.size / 1024 < 0) {
                    console.error("[Downloader.js] Failed downloading file " + fileName);
                    count++;
                    console.log("[Downloader.js] " + fileName + " retry count: " + count);
                    forceDownloadWithRetry(url, fileName, zipFlag, count);
                    return;
                }
                dlList.push(fileName);
                var urlCreator = window.URL || window.webkitURL;
                var imageUrl = urlCreator.createObjectURL(response.response);
                if (!zipFlag) {
                    var tag = document.createElement('a');
                    tag.href = imageUrl;
                    tag.download = fileName;
                    document.body.appendChild(tag);
                    tag.click();
                    document.body.removeChild(tag);
                    return;
                }
                addFile(fileName, response.response);
                if (dlList.length === totalImage) {
                    console.info("[Downloader.js] Preparing zip file...");
                    zip.generateAsync({ type: 'blob' }).then(function (blob) {
                        var imageUrl = urlCreator.createObjectURL(blob);
                        var tag = document.createElement('a');
                        tag.href = imageUrl;
                        tag.download = "[" + generateAuthorName() + "] " + document.getElementsByClassName("post__title")[0].getElementsByTagName("span")[0].textContent + ".zip";
                        document.body.appendChild(tag);
                        tag.click();
                        document.body.removeChild(tag);
                    });
                }
            },
            onprogress: function (e) {
                if (e.callengthComputable) {
                    var ratio = Math.floor((e.loaded / e.total) * 100) + '%';
                    console.log("[Downloader.js] " + fileName + " > " + ratio);
                    return;
                }
                console.log("[Downloader.js] " + fileName + " downloaded " + (e.loaded / 1024).toFixed(3) + "kB (No total length found)");
            },
            onerror: function (e) {
                console.error("[Downloader.js] Failed downloading file " + fileName);
                count++;
                console.log("[Downloader.js] " + fileName + " retry count: " + count);
                forceDownloadWithRetry(url, fileName, zipFlag, count);
            },
        });
    }

    function generateAuthorName() {
        var str = document.getElementsByClassName("post__user-name")[0].textContent;
        return str.replace(/\s+/g, "").replace(/[\r\n]/g, "");
    }

    function getFileThumbs() {
        var list = document.getElementsByClassName("fileThumb image-link");
        if (list.length === 0) {
            list = document.getElementsByClassName("fileThumb");
        }
        return list;
    }

    function getImageLinks() {
        var thumbnail_list = getFileThumbs();
        var imgs = [];
        for (let index = 0; index < thumbnail_list.length; index++) {
            if (index === 0 && !document.getElementById("needFirstImageCheckbox").checked) {
                continue;
            }
            imgs.push(thumbnail_list[index]["href"]);
        }
        return imgs;
    }

    function modifiedNames() {
        var thumbnail_list = getFileThumbs();
        var name = document.getElementsByClassName("post__title")[0].getElementsByTagName("span")[0].textContent;
        for (let index = 0; index < thumbnail_list.length; index++) {
            if (index === 0 && !document.getElementById("needFirstImageCheckbox").checked) {
                continue;
            }
            var url = thumbnail_list[index]["href"];
            thumbnail_list[index]["download"] = name + "_" + index + "." + url.split(".")[url.split(".").length - 1];
        }
    }
})();