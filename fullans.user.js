// ==UserScript==
// @name         FULL ANS OLM
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Hack olm by TienMinhDz
// @author       TienMinhDz
// @match        https://olm.vn/*
// @grant        unsafeWindow
// @run-at       document-start
// @downloadURL https://update.greasyfork.org/scripts/552562/Hack%20olm.user.js
// @updateURL https://update.greasyfork.org/scripts/552562/Hack%20olm.meta.js
// ==/UserScript==

(function() {
    'use strict';

    const TARGET_URL_KEYWORD = 'get-question-of-ids';

    function decodeBase64Utf8(base64) {
        try {
            const binaryString = atob(base64);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                bytes[i] = binaryString.charCodeAt(i);
            }
            return new TextDecoder('utf-8').decode(bytes);
        } catch (e) {
            console.error("Lỗi giải mã Base64:", e);
            return 'Lỗi giải mã nội dung!';
        }
    }

    class AnswerDisplay {
        constructor() {
            this.isVisible = true;
            this.dragState = { isDragging: false, startX: 0, startY: 0, initialX: 0, initialY: 0 };
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseMove = this.onMouseMove.bind(this);
            this.onMouseUp = this.onMouseUp.bind(this);
            this.onKeyDown = this.onKeyDown.bind(this);
        }

        init() {
            this.injectCSS();
            this.createUI();
            this.addEventListeners();
        }

        injectCSS() {
            const styles = `
                @keyframes gradient-animation {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                #olm-answers-container {
                    position: fixed; top: 10px; right: 10px; width: 450px; max-height: 90vh;
                    border: 1px solid #cccccc; border-radius: 8px;
                    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.2); z-index: 10000;
                    display: flex; flex-direction: column; font-size: 14px; resize: both;
                    overflow: hidden; transition: opacity 0.2s, transform 0.2s;
                    color: #333;
                    background: linear-gradient(45deg, #e0f7fa, #d1c4e9, #fce4ec, #e0f7fa);
                    background-size: 400% 400%;
                    animation: gradient-animation 20s ease infinite;
                }
                #olm-answers-container.hidden {
                    opacity: 0; transform: scale(0.95); pointer-events: none;
                }
                .olm-answers-header {
                    padding: 10px 15px; background-color: rgba(255, 255, 255, 0.4); border-bottom: 1px solid #cccccc;
                    cursor: move; user-select: none; font-weight: bold;
                    text-align: center;
                }
                #olm-answers-content {
                    padding: 10px; margin: 0; flex-grow: 1; overflow-y: auto;
                    background-color: rgba(255, 255, 255, 0.8);
                }
                #olm-answers-content::-webkit-scrollbar { width: 8px; }
                #olm-answers-content::-webkit-scrollbar-track { background: #f1f1f1; }
                #olm-answers-content::-webkit-scrollbar-thumb { background: #888; border-radius: 4px; }
                #olm-answers-content::-webkit-scrollbar-thumb:hover { background: #555; }
            `;
            const styleSheet = document.createElement("style");
            styleSheet.type = "text/css";
            styleSheet.innerText = styles;
            document.head.appendChild(styleSheet);
        }

        createUI() {
            this.container = document.createElement('div');
            this.container.id = 'olm-answers-container';
            this.header = document.createElement('div');
            this.header.className = 'olm-answers-header';
            this.header.innerHTML = 'Đáp Án Đúng (Nhấn Shift phải để Ẩn/Hiện)';
            this.contentArea = document.createElement('div');
            this.contentArea.id = 'olm-answers-content';
            this.container.append(this.header, this.contentArea);

            const appendToBody = () => document.body.appendChild(this.container);
            if (document.body) appendToBody();
            else window.addEventListener('DOMContentLoaded', appendToBody);
        }

        addEventListeners() {
            setTimeout(() => {
                 this.header.addEventListener('mousedown', this.onMouseDown);
                 window.addEventListener('keydown', this.onKeyDown);
            }, 500);
        }

        onMouseDown(event) {
            this.dragState.isDragging = true;
            const rect = this.container.getBoundingClientRect();
            this.container.style.right = 'auto';
            this.container.style.bottom = 'auto';
            this.container.style.left = `${rect.left}px`;
            this.container.style.top = `${rect.top}px`;
            this.dragState.initialX = rect.left;
            this.dragState.initialY = rect.top;
            this.dragState.startX = event.clientX;
            this.dragState.startY = event.clientY;
            window.addEventListener('mousemove', this.onMouseMove);
            window.addEventListener('mouseup', this.onMouseUp);
        }

        onMouseMove(event) {
            if (!this.dragState.isDragging) return;
            event.preventDefault();
            const dx = event.clientX - this.dragState.startX;
            const dy = event.clientY - this.dragState.startY;
            this.container.style.left = `${this.dragState.initialX + dx}px`;
            this.container.style.top = `${this.dragState.initialY + dy}px`;
        }

        onMouseUp() {
            this.dragState.isDragging = false;
            window.removeEventListener('mousemove', this.onMouseMove);
            window.removeEventListener('mouseup', this.onMouseUp);
        }

        onKeyDown(event) {
            if (event.code === 'ShiftRight') {
                this.toggleVisibility();
            }
        }

        toggleVisibility() {
            this.isVisible = !this.isVisible;
            this.container.classList.toggle('hidden', !this.isVisible);
        }

        findAndFormatAnswers(tempDiv) {
            let correctAnswers = tempDiv.querySelectorAll('.correctAnswer');
            if (correctAnswers.length > 0) {
                 return `<ul>${Array.from(correctAnswers).map(ans => `<li>${ans.innerHTML}</li>`).join('')}</ul>`;
            }
            const fillInInput = tempDiv.querySelector('input[data-accept]');
            if (fillInInput) {
                const answers = fillInInput.getAttribute('data-accept').split('|').map(a => a.trim());
                if (answers.length > 0) {
                    return `<ul>${answers.map(a => `<li>${a}</li>`).join('')}</ul>`;
                }
            }
            const hintSpan = tempDiv.querySelector('span[class*="dap-an"], span[class*="answer"]');
            if(hintSpan && hintSpan.textContent) {
                return `<ul><li>${hintSpan.textContent.trim()}</li></ul>`;
            }
            return null;
        }

        /**
         * Chạy lại hàm render công thức toán gốc của OLM trên một vùng nội dung.
         * Điều này đảm bảo tính tương thích cao nhất.
         * @param {HTMLElement} element - Vùng chứa nội dung cần render.
         */
        renderContentWithOLM(element) {
            setTimeout(() => {
                // Thử tìm hàm render Katex hoặc Mathjax của OLM trong phạm vi `window`
                const renderFunc = unsafeWindow.renderKatex ||
                                   (unsafeWindow.MathJax && (unsafeWindow.MathJax.typeset || (unsafeWindow.MathJax.Hub && unsafeWindow.MathJax.Hub.Queue)));

                if (typeof renderFunc === 'function') {
                    try {
                        // Gọi hàm render của OLM
                        if (unsafeWindow.MathJax && unsafeWindow.MathJax.typeset) { // MathJax v3
                            unsafeWindow.MathJax.typeset([element]);
                        } else if (unsafeWindow.MathJax && unsafeWindow.MathJax.Hub) { // MathJax v2
                             unsafeWindow.MathJax.Hub.Queue(["Typeset", unsafeWindow.MathJax.Hub, element]);
                        } else { // Các hàm render khác như renderKatex
                             renderFunc(element);
                        }
                    } catch (e) {
                        console.error("Lỗi khi thực thi hàm render của OLM:", e);
                    }
                }
            }, 200); // Tăng độ trễ để đảm bảo trang tải xong
        }


        renderData(data) {
            if (!Array.isArray(data)) return;

            const responseContainer = document.createElement('div');
            const timestamp = new Date().toLocaleTimeString();
            responseContainer.innerHTML = `<p style="font-family: monospace; font-size: 12px; background: rgba(0,0,0,0.05); padding: 5px; border-radius: 4px;"><b>Time:</b> ${timestamp}</p>`;

            data.forEach(question => {
                const decodedContent = decodeBase64Utf8(question.content || '');
                if (!decodedContent) return;

                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = decodedContent;

                const answersHtml = this.findAndFormatAnswers(tempDiv);

                const questionContentDiv = tempDiv.cloneNode(true);
                const choiceBlock = questionContentDiv.querySelector('ol.quiz-list, ul.quiz-list, .interaction, .form-group');
                if (choiceBlock) {
                    choiceBlock.remove();
                }
                const questionDisplayHtml = questionContentDiv.innerHTML.trim();

                const questionDiv = document.createElement('div');
                questionDiv.style.cssText = 'padding: 8px; border-left: 3px solid #007bff; margin-bottom: 12px; background: rgba(255,255,255,0.6); border-radius: 0 4px 4px 0;';

                questionDiv.innerHTML = `
                    <div style="font-weight: bold; color: #0056b3; margin-bottom: 5px;">${questionDisplayHtml || question.title}</div>
                    <div style="font-weight: bold; color: #dc3545; padding: 5px 0 0 10px;">
                        ${answersHtml || '<p style="margin:0; font-style: italic; color: #777;">Không tìm thấy đáp án được đánh dấu.</p>'}
                    </div>`;

                responseContainer.appendChild(questionDiv);
            });

            this.contentArea.prepend(responseContainer);

            // Gọi hàm render mới
            this.renderContentWithOLM(this.contentArea);
        }
    }

    const answerUI = new AnswerDisplay();
    answerUI.init();

    const originalFetch = unsafeWindow.fetch;
    unsafeWindow.fetch = function(...args) {
        const requestUrl = args[0] instanceof Request ? args[0].url : args[0];
        const promise = originalFetch.apply(this, args);
        if (requestUrl.includes(TARGET_URL_KEYWORD)) {
            promise.then(response => {
                if (response.ok) {
                    response.clone().json().then(data => answerUI.renderData(data)).catch(err => console.error(err));
                }
            });
        }
        return promise;
    };

    const originalSend = XMLHttpRequest.prototype.send;
    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('load', () => {
            if (this.responseURL?.includes(TARGET_URL_KEYWORD) && this.status === 200) {
                try {
                    const data = JSON.parse(this.responseText);
                    answerUI.renderData(data);
                } catch (e) { console.error(e) }
            }
        });
        return originalSend.apply(this, args);
    };
})();
