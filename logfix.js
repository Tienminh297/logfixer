// ==UserScript==
// @name         HACK OLM BY TIENMINHDZ (Refactored)
// @namespace    http://tampermonkey.net/
// @version      2.7.1
// @description  Menu tự động mở, giao diện nhỏ gọn, tìm khóa "data:[number]" tự động. Đã được tái cấu trúc code.
// @author       TienMinhDz (Refactored by AI)
// @match        *://*/*
// @grant        GM_addStyle
// @grant        GM.xmlHttpRequest
// @run-at       document-start
// ==/UserScript==

(function() {
    'use strict';

    // ----------------------------------------------------
    // CẤU HÌNH CỐ ĐỊNH
    // ----------------------------------------------------
    const KEY_FILE_URL = 'https://raw.githubusercontent.com/Tienminh297/logfixer/main/keys.txt';

    const MENU_ID = 'log_fixer_menu';
    const AUTH_FORM_ID = 'log_fixer_auth_form';
    const CONFIG_FORM_ID = 'log_fixer_config_form';
    const OVERLAY_ID = 'log_fixer_overlay';
    const TOGGLE_BUTTON_ID = 'menuToggleButton';
    const STATUS_LOAD_ID = 'keyLoadStatus';

    let VALID_KEY_HASHES = null;
    let keysLoadPromise = null;

    // ----------------------------------------------------
    // CSS GIAO DIỆN
    // ----------------------------------------------------

    GM_addStyle(`
        /* Font chung */
        #${OVERLAY_ID}, #${MENU_ID}, #${TOGGLE_BUTTON_ID} {
            font-family: 'Inter', Arial, sans-serif;
        }

        /* Nút Mở/Đóng Menu nhỏ gọn */
        #${TOGGLE_BUTTON_ID} {
            position: fixed;
            top: 15px;
            right: 15px;
            width: 45px;
            height: 45px;
            border-radius: 50%;
            background-color: #007bff; /* Xanh dương nổi bật */
            color: white;
            font-size: 1.5em;
            font-weight: bold;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
            z-index: 100000;
            transition: background-color 0.3s, transform 0.2s;
            border: 3px solid #fff;
            user-select: none;
        }
        #${TOGGLE_BUTTON_ID}:hover {
            background-color: #0056b3;
            transform: scale(1.05);
        }

        /* Overlay (Màn hình mờ chứa Menu chính) */
        #${OVERLAY_ID} {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 99999;
            background-color: transparent;
            display: none; /* Mặc định ẩn */
            justify-content: flex-end;
            align-items: flex-start;
            padding: 15px;
            transition: background-color 0.3s ease;
        }

        /* Menu chính */
        #${MENU_ID} {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
            padding: 15px 20px;
            width: 95%;
            max-width: 350px;
            text-align: left;
            color: #343a40;
            position: relative;
        }

        h2 {
            margin-top: 0;
            font-size: 1.25em;
            color: #007bff;
            border-bottom: 1px solid #dee2e6;
            padding-bottom: 8px;
            margin-bottom: 15px;
        }
        label {
            display: block;
            margin-top: 10px;
            margin-bottom: 3px;
            font-weight: 600;
            font-size: 0.9em;
        }
        input[type="text"], input[type="number"], input[type="password"] {
            width: 100%;
            padding: 8px;
            border: 1px solid #ced4da;
            border-radius: 4px;
            box-sizing: border-box;
            font-size: 0.9em;
        }
        button {
            background-color: #28a745;
            color: white;
            padding: 10px 15px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 0.95em;
            transition: background-color 0.3s;
            margin-top: 15px;
            width: 100%;
        }
        button:hover:not(:disabled) {
            background-color: #218838;
        }
        button:disabled {
            background-color: #6c757d;
            cursor: not-allowed;
        }
        .error {
            color: #dc3545;
            margin-top: 10px;
            font-weight: bold;
        }
        #closeMenu {
            position: absolute;
            top: 5px;
            right: 5px;
            background: none;
            border: none;
            color: #6c757d;
            font-size: 1.2em;
            padding: 5px;
            margin: 0;
            cursor: pointer;
        }
        /* Hiển thị rõ khóa log đã tìm thấy */
        #logKeyDisplay {
            margin-top: 10px;
            padding: 8px;
            background-color: #e9ecef;
            border-radius: 4px;
            font-family: monospace;
            font-size: 0.85em;
            word-break: break-all;
        }
        #${CONFIG_FORM_ID} {
            display: none;
        }
    `);

    // ----------------------------------------------------
    // HÀM TIỆN ÍCH
    // ----------------------------------------------------

    /**
     * Mã hóa chuỗi thành Base64 (dùng cho xác thực key).
     * @param {string} message Chuỗi cần mã hóa.
     * @returns {string} Chuỗi đã mã hóa Base64.
     */
    const base64Encode = (message) => {
        try {
            return btoa(message);
        } catch (e) {
            console.error("[Log Fixer] Lỗi mã hóa Base64:", e);
            return '';
        }
    };

    /**
     * Hiển thị/Ẩn Menu chính.
     */
    const toggleMenu = () => {
        const overlay = document.getElementById(OVERLAY_ID);
        if (overlay) {
            const isVisible = overlay.style.display === 'flex';
            overlay.style.display = isVisible ? 'none' : 'flex';
            overlay.style.backgroundColor = isVisible ? 'transparent' : 'rgba(0, 0, 0, 0.3)';
        }
    };

    // ----------------------------------------------------
    // TẢI VÀ XÁC THỰC KEY
    // ----------------------------------------------------

    /**
     * Tải danh sách Key đã mã hóa từ GitHub.
     * @returns {Promise<boolean>} Trả về true nếu tải thành công.
     */
    const fetchKeysFromGitHub = () => {
        return new Promise((resolve) => {
            const statusDiv = document.getElementById(STATUS_LOAD_ID);
            if (!statusDiv) {
                console.error("[Log Fixer] Không tìm thấy #keyLoadStatus.");
                VALID_KEY_HASHES = [];
                return resolve(false);
            }

            statusDiv.textContent = "Đang tải keys...";

            GM.xmlHttpRequest({
                method: "GET",
                url: KEY_FILE_URL,
                onload: function(response) {
                    if (response.status === 200) {
                        const lines = response.responseText.split('\n');
                        // Lọc và trim() từng dòng để loại bỏ khoảng trắng thừa
                        VALID_KEY_HASHES = lines
                            .map(line => line.trim())
                            .filter(line => line.length > 0);

                        console.log(`%c[Log Fixer] Tải keys thành công. Tổng số keys: ${VALID_KEY_HASHES.length}`, 'color: green;');
                        statusDiv.innerHTML = `<span style="color: #28a745;">✅ Keys đã tải thành công (${VALID_KEY_HASHES.length} keys).</span>`;
                        resolve(true);
                    } else {
                        console.error(`[Log Fixer] Lỗi tải keys. Mã trạng thái: ${response.status}.`);
                        statusDiv.innerHTML = `<span class="error">❌ Lỗi tải key (Mã: ${response.status}). Vui lòng kiểm tra URL Raw.</span>`;
                        VALID_KEY_HASHES = [];
                        resolve(false);
                    }
                },
                onerror: function(error) {
                    console.error("[Log Fixer] Lỗi kết nối GitHub:", error);
                    statusDiv.innerHTML = `<span class="error">❌ Lỗi kết nối mạng. Không thể tải keys.</span>`;
                    VALID_KEY_HASHES = [];
                    resolve(false);
                }
            });
        });
    };

    /**
     * Xác thực key đã mã hóa của người dùng với danh sách đã tải.
     * @param {string} encodedKey Key đã mã hóa Base64 của người dùng.
     * @returns {boolean} True nếu Key hợp lệ.
     */
    const validateKeyLocally = (encodedKey) => {
        if (!VALID_KEY_HASHES) {
            console.error("[Log Fixer] Lỗi: Key list chưa được tải.");
            return false;
        }
        return VALID_KEY_HASHES.includes(encodedKey);
    };

    // ----------------------------------------------------
    // LOGIC TÌM KIẾM VÀ SỬA LOG
    // ----------------------------------------------------

    /**
     * Tự động tìm kiếm khóa log có dạng "data:[số dài]" trong localStorage.
     * Regex mới: /^data:\d+/ cho phép các ký tự theo sau dãy số.
     * @returns {string|null} Khóa tìm thấy hoặc null.
     */
    const findLogKey = () => {
        const dataRegex = /^data:\d+/;
        console.log("[Log Fixer] Bắt đầu tìm kiếm khóa log...");
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (dataRegex.test(key)) {
                    console.log(`%c[Log Fixer] Đã tìm thấy key: ${key}`, 'color: green; font-weight: bold;');
                    return key;
                }
            }
        } catch (e) {
            console.error("[Log Fixer] Lỗi khi truy cập localStorage:", e);
        }
        console.log("[Log Fixer] Kết thúc tìm kiếm. Không tìm thấy key phù hợp.");
        return null;
    };

    /**
     * Sửa đổi dữ liệu log JSON để đạt điểm tối đa và thời gian mong muốn.
     * @param {string} originalLogString Dữ liệu log gốc (JSON string) từ localStorage.
     * @param {number} targetScore Điểm mong muốn.
     * @param {number} targetTimeSpent Thời gian làm bài mong muốn (giây).
     * @returns {string|null} Dữ liệu log mới đã sửa (JSON string) hoặc null nếu lỗi.
     */
    const fixLogData = (originalLogString, targetScore, targetTimeSpent) => {
        if (!originalLogString) { return null; }
        try {
            const logData = JSON.parse(originalLogString);
            let innerDataLog = logData.data_log;
            let isStringEscaped = typeof innerDataLog === 'string';

            // Phân tích cú pháp nếu data_log là một chuỗi JSON đã thoát
            if (isStringEscaped) {
                innerDataLog = JSON.parse(innerDataLog);
            }

            if (!Array.isArray(innerDataLog)) {
                console.warn("[Log Fixer] Cấu trúc data_log không phải là Array.");
                return null;
            }

            // Sửa tất cả các entry thành đúng (100% correct)
            const fixedInnerLog = innerDataLog.map(entry => ({
                ...entry,
                result: 1, // Kết quả: Đúng
                correct: 1, // Số câu đúng: 1
                wrong: 0, // Số câu sai: 0
            }));

            const totalQuestions = fixedInnerLog.length;

            // Cập nhật các trường tổng hợp
            logData.correct = totalQuestions;
            logData.missed = 0;
            logData.answered = totalQuestions;
            logData.count_problems = totalQuestions;
            logData.score = targetScore;
            logData.time_spent = targetTimeSpent;

            // Đặt lại data_log (có thể là chuỗi JSON đã thoát hoặc đối tượng Array)
            if (isStringEscaped) {
                // Nếu ban đầu là chuỗi, phải chuyển lại thành chuỗi JSON đã thoát
                logData.data_log = JSON.stringify(fixedInnerLog);
            } else {
                // Nếu ban đầu là đối tượng Array, giữ nguyên là đối tượng
                logData.data_log = fixedInnerLog;
            }

            return JSON.stringify(logData);

        } catch (e) {
            console.error("[Log Fixer] Lỗi khi xử lý/phân tích JSON:", e);
            return null;
        }
    };

    // ----------------------------------------------------
    // XỬ LÝ SỰ KIỆN
    // ----------------------------------------------------

    /**
     * Xử lý sự kiện xác thực key truy cập.
     */
    const handleAuth = async () => {
        const keyInput = document.getElementById('accessKeyInput');
        const authStatus = document.getElementById('authStatus');
        const rawKey = keyInput.value.trim();

        if (!rawKey || rawKey.length < 6) {
            authStatus.textContent = 'Key không hợp lệ. Vui lòng kiểm tra lại.';
            return;
        }

        authStatus.textContent = 'Đang xác thực Key...';

        // Đảm bảo Key list đã được tải
        if (VALID_KEY_HASHES === null && keysLoadPromise) {
            await keysLoadPromise;
        }

        if (VALID_KEY_HASHES && VALID_KEY_HASHES.length > 0) {
            const userEncodedKey = base64Encode(rawKey);
            const isValid = validateKeyLocally(userEncodedKey);

            if (isValid) {
                authStatus.innerHTML = '<span style="color: #28a745;">Key đã được xác thực thành công!</span>';

                // Cấu hình Menu Sửa Log
                const foundKey = findLogKey();
                const displayDiv = document.getElementById('logKeyDisplay');
                const inputHidden = document.getElementById('logKeyInput');
                const manualInput = document.getElementById('manualLogKeyInput');

                if (foundKey) {
                    displayDiv.innerHTML = `**Khóa Log Tự Động:** <span style="font-weight: bold; color: #007bff;">${foundKey}</span>`;
                    inputHidden.value = foundKey;
                    manualInput.placeholder = `VD: ${foundKey}`;
                } else {
                    displayDiv.innerHTML = `<span class="error">**LỖI:** Không tìm thấy khóa log tự động. Vui lòng dán key thủ công.</span>`;
                    inputHidden.value = '';
                    manualInput.placeholder = "Vui lòng dán Key Log từ Local Storage (VD: data:123...)";
                }

                // Chuyển sang chế độ Cấu hình
                document.getElementById(AUTH_FORM_ID).style.display = 'none';
                document.getElementById(CONFIG_FORM_ID).style.display = 'block';

            } else {
                authStatus.textContent = 'Key truy cập không đúng. Vui lòng kiểm tra lại.';
            }
        } else {
            authStatus.innerHTML = '<span class="error">Lỗi: Key list trống. Vui lòng tải lại trang hoặc kiểm tra kết nối mạng.</span>';
        }
    };

    /**
     * Xử lý sự kiện áp dụng sửa log.
     */
    const handleApplyFix = () => {
        // Lấy Key Log, ưu tiên thủ công (manualLogKeyInput)
        const manualLogKey = document.getElementById('manualLogKeyInput').value.trim();
        const autoLogKey = document.getElementById('logKeyInput').value.trim();
        const logKey = manualLogKey || autoLogKey;

        const scoreInput = document.getElementById('scoreInput').value;
        const timeInput = document.getElementById('timeInput').value;
        const statusDiv = document.getElementById('statusMessage');

        const targetScore = parseInt(scoreInput);
        const targetTimeSpent = parseInt(timeInput);

        if (!logKey || isNaN(targetScore) || isNaN(targetTimeSpent) || targetScore < 0 || targetTimeSpent < 0) {
            statusDiv.innerHTML = '<span class="error">Vui lòng nhập đầy đủ và hợp lệ các trường. Hoặc Key Log không được để trống.</span>';
            return;
        }

        const originalLog = localStorage.getItem(logKey);

        if (!originalLog) {
            statusDiv.innerHTML = `<span class="error">Lỗi: Không tìm thấy Khóa Log (${logKey}) trong Local Storage. Hãy kiểm tra lại.</span>`;
            return;
        }

        const newLog = fixLogData(originalLog, targetScore, targetTimeSpent);

        if (newLog) {
            if (newLog !== originalLog) {
                localStorage.setItem(logKey, newLog);
                statusDiv.innerHTML = `<span style="color: #28a745; font-weight: bold;">ĐÃ SỬA THÀNH CÔNG!</span><br>Log Key: ${logKey}<br>Điểm: ${targetScore}, Thời gian: ${targetTimeSpent}s.<br>Vui lòng **Tải Lại Trang** để xem kết quả.`;
                console.log(`%c[Log Fixer] Dữ liệu log đã được sửa thành công cho key: ${logKey}`, 'color: green; font-size: 14px;');
            } else {
                statusDiv.innerHTML = '<span style="color: orange;">Dữ liệu đã hợp lệ hoặc không có gì để sửa đổi.</span>';
            }
        } else {
            statusDiv.innerHTML = '<span class="error">Lỗi: Không thể phân tích hoặc sửa đổi cấu trúc log.</span>';
        }
    };

    // ----------------------------------------------------
    // KHỞI TẠO GIAO DIỆN VÀ EVENTS
    // ----------------------------------------------------

    const setupGUI = () => {
        // Tạo HTML cho Overlay Menu
        const overlayHTML = `
            <div id="${OVERLAY_ID}">
                <div id="${MENU_ID}">
                    <button id="closeMenu" title="Đóng Menu">✖</button>

                    <div id="${AUTH_FORM_ID}">
                        <h2 id="authTitle">🔐 Log Fixer: Xác Thực Key</h2>
                        <div id="${STATUS_LOAD_ID}" style="margin-top: 10px; font-size: 0.85em; color: #6c757d;">Đang khởi tạo...</div>
                        <label for="accessKeyInput">Key Truy Cập:</label>
                        <input type="password" id="accessKeyInput" placeholder="Nhập key đã mua">
                        <button id="authButton">Xác Nhận Key</button>
                        <div id="authStatus" class="error"></div>
                    </div>

                    <div id="${CONFIG_FORM_ID}">
                        <h2>⚙️ Sửa Log (100% Correct)</h2>
                        <div id="logKeyDisplay" style="margin-bottom: 10px; color: #007bff;"></div>

                        <label for="manualLogKeyInput">Key Log thủ công (Dán từ Local Storage):</label>
                        <input type="text" id="manualLogKeyInput" placeholder="VD: data:123456789...">
                        <p style="font-size: 0.75em; color: #dc3545; margin-top: 5px;">*Để trống nếu muốn dùng Key tự động tìm thấy ở trên.</p>

                        <input type="hidden" id="logKeyInput" value="">

                        <label for="scoreInput">Điểm Tùy Chỉnh:</label>
                        <input type="number" id="scoreInput" value="100" min="0">

                        <label for="timeInput">Thời Gian Làm Bài (giây):</label>
                        <input type="number" id="timeInput" value="23" min="0">

                        <button id="applyButton">Áp Dụng Sửa Log</button>
                        <div id="statusMessage"></div>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', overlayHTML);

        // Tạo HTML cho Nút toggle
        const toggleButtonHTML = `<div id="${TOGGLE_BUTTON_ID}" title="Mở Menu (Ctrl + M)">⚙️</div>`;
        document.body.insertAdjacentHTML('beforeend', toggleButtonHTML);

        // Đăng ký sự kiện
        document.getElementById('closeMenu').addEventListener('click', toggleMenu);
        document.getElementById(TOGGLE_BUTTON_ID).addEventListener('click', toggleMenu);
        document.getElementById('authButton').addEventListener('click', handleAuth);
        document.getElementById('applyButton').addEventListener('click', handleApplyFix);

        // Thêm phím tắt Ctrl + M
        window.addEventListener('keydown', (event) => {
            // Kiểm tra phím M (case-insensitive) và Ctrl
            if (event.ctrlKey && event.key.toLowerCase() === 'm') {
                event.preventDefault();
                toggleMenu();
            }
        });
    };

    // ----------------------------------------------------
    // KHỞI TẠO CHÍNH
    // ----------------------------------------------------

    document.addEventListener('DOMContentLoaded', () => {
        // Cần setupGUI trước để có các phần tử DOM để hiển thị trạng thái tải Key
        setupGUI();
        // Bắt đầu tải Keys bất đồng bộ
        keysLoadPromise = fetchKeysFromGitHub();
    });

})();
