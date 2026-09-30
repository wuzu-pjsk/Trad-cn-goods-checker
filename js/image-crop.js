// image-crop.js — 圖片裁切彈窗（基於 Cropper.js）
// 依賴：Cropper.js CDN（cropper.min.css + cropper.min.js）

/**
 * 開啟裁切彈窗
 * @param {string} base64 - 圖片 base64 data URL
 * @param {object|function} opts - 選項 { aspectRatio?: number, title?: string } 或直接傳 callback
 * @param {function} callback - 裁切完成後回呼 (croppedBase64|null)
 */
function openImageCrop(base64, opts, callback) {
    if (typeof opts === 'function') { callback = opts; opts = {}; }
    opts = opts || {};
    callback = callback || function() {};

    var title = opts.title || '裁切圖片';
    var aspectRatio = opts.aspectRatio || NaN;

    closeImageCrop();

    var html = '<div id="imageCropModal" class="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-[100] p-4">' +
        '<div class="bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col" style="max-height:90vh">' +
        '<div class="flex items-center justify-between px-4 py-3 border-b border-gray-200">' +
        '<h3 class="text-base font-bold text-gray-800">' + escapeHtml(title) + '</h3>' +
        '<button onclick="closeImageCrop()" class="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>' +
        '</div>' +
        '<div class="p-4 flex-1 flex items-center justify-center bg-gray-100" style="min-height:300px">' +
        '<img id="imageCropImg" src="' + base64 + '" alt="crop" style="max-width:100%;max-height:50vh">' +
        '</div>' +
        '<div class="flex justify-between items-center px-4 py-3 border-t border-gray-200 gap-3">' +
        '<button id="imageCropSkipBtn" class="px-4 py-2 text-sm text-gray-500 border border-gray-300 rounded-lg hover:bg-gray-50">跳過裁切</button>' +
        '<button id="imageCropConfirmBtn" class="px-5 py-2 text-sm bg-blue-500 text-white rounded-lg font-bold hover:bg-blue-600 shadow">確認裁切</button>' +
        '</div></div></div>';

    var overlay = document.createElement('div');
    overlay.innerHTML = html;
    document.body.appendChild(overlay.firstElementChild);

    var imgEl = document.getElementById('imageCropImg');
    var cropper = new Cropper(imgEl, {
        aspectRatio: aspectRatio,
        viewMode: 1,
        autoCropArea: 0.9,
        responsive: true,
        guides: true,
        center: true,
        zoomable: true,
        movable: true
    });

    document.getElementById('imageCropConfirmBtn').onclick = function() {
        var canvas = cropper.getCroppedCanvas({ maxWidth: 1200, maxHeight: 1200 });
        if (canvas) {
            var croppedBase64 = canvas.toDataURL('image/jpeg', 0.85);
            closeImageCrop();
            callback(croppedBase64);
        }
    };

    document.getElementById('imageCropSkipBtn').onclick = function() {
        closeImageCrop();
        callback(null);
    };
}

function closeImageCrop() {
    var modal = document.getElementById('imageCropModal');
    if (modal) modal.remove();
}
