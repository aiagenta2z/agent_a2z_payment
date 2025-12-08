const agentName = "a2z_payment_agent_sandbox";
const scene = "agent_deepnlp_web";

/**
* Loading App HomePage First Time Login Request
* Unauthentificated: /login_app test_user
* authentificated: Don't Logged in
* called in template, put outside module
*/
async function postIndexPageLoginUser() {
    //
    try {
        var ifCleanLocalStorage = false;
        if (ifCleanLocalStorage) {
            
            var beforeDataUserId = localStorage.getItem(scene + "_user_id"); 
            localStorage.removeItem(scene + "_user_id");
            var afterdataUserId = localStorage.getItem(scene + "_user_id"); 
            console.log(`Removing localStorage dataUserId ${beforeDataUserId} and after ${afterdataUserId}...`)
            return;
        }
        var activeUserIdElem  = document.getElementById("dialogue_user_id");
        var activeUserId = activeUserIdElem?.textContent;
        // check local storage to see if it's first time rendering 
        var dataUserId = localStorage.getItem(scene + "_user_id"); // get ”null“ str
        if (dataUserId == "null" || dataUserId == null || activeUserId == null) {
            // Login Visitor (USER_xxx) to App and Update Session
            var activeImageIdAvatar = "";
            var activeUserGroup = "free";
            var activeAccessKey = "";

            var loginAppEndPoint = "/login_app";
            var loginAppData = {
                    user_id: activeUserId,
                    user_group: "free",
                    access_key: "",
                    scene: ""
            };
            var loginAppDataJson = JSON.stringify(loginAppData);                
            const appLoginResponse = await fetch(loginAppEndPoint, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: loginAppDataJson
            });
            if (!appLoginResponse.ok) {
                        console.log(`HTTP ${appLoginResponse.status}: ${appLoginResponse.statusText}`);
            }
            // 3.0 Save Login Information to Local Storage
            localStorage.setItem(scene + "_user_id", activeUserId);
            localStorage.setItem(scene + "_image_id_avatar", activeImageIdAvatar);
            localStorage.setItem(scene + "_user_group", activeUserGroup);
            localStorage.setItem(scene + "_access_key", activeAccessKey);
        } else {
            // User Logged In check if visitor or logged in user
            console.log(`MCP Tool Agent postIndexPageLoginUser dataUserId ${dataUserId} and activeUserId ${activeUserId}`)
        }
    } catch (err) {
        console.error(err);
    }
}

function clean_login_from_local_storage() {
    try {
        localStorage.removeItem(scene + "_user_id");
        localStorage.removeItem(scene + "_image_id_avatar");
        localStorage.removeItem(scene + "_user_group");
        localStorage.removeItem(scene + "_access_key");
    } catch (err) {
        console.error(err);
    }
}

document.addEventListener('DOMContentLoaded', function() {

    // Global Config
    const globalConfig = initializeGlobalConfig();
    const productionUrlPrefix = globalConfig.productionUrlPrefix;
    // const productionUrlPrefix = "/agent/mcp_tool_use"
    console.log("Initializing Global Config productionUrlPrefix" + productionUrlPrefix);

    // Element/Plugin
    const sendBtn = document.getElementById('sendBtn');
    const chatbox = document.getElementById('chatbox');
    const searchInput = document.getElementById('searchInput');    
    const sidebar = document.querySelector('.sidebar');
    const collapseBtn = document.querySelector('.collapse-btn');
    const systemMessages = document.getElementById('system-messages');
    const newChatBtn = document.getElementById('new-chat');
    // const aiAgentMarketplaceSidebar = document.getElementById('all-apps');
    const mcpMarketplaceSidebar = document.getElementById('mcp-marketplace-sidebar');
    const aiAgentMarketplaceSidebar = document.getElementById('ai-agent-marketplace-sidebar');
    const historyItemSideBar = document.querySelectorAll('.history-item');
    const settingBtn = document.querySelector('.setting-btn');
    // Response Card Action: Click Copy Button
    const chatContainerDiv = document.querySelector(".chat-container");
    const mainContentDiv = document.querySelector(".main-content");
    const previewSectionDiv = document.querySelector(".preview-section");
    const previewContentElem = document.querySelector(".preview-content");
    const serverScrollDiv = document.querySelector(".mcp-servers-scroll-container");
    const userInfoLoginBtn = document.querySelector(".user-info-login-btn-small");
    // processing received message
    const messageStates = new Map();
    const TYPEWRITER_SPEED = 5000;
    const MARKDOWN_RENDER_DELAY = 200;

    const messageClsUserOutgoing = "message user outgoing";
    const messageClsAssistantIncoming = "message assistant bot-message";
    
    const messageRoleAssistant = "assistant";
    const messageRoleUser = "user";

    // initialization of new page
    let chatHistory = [];
    var pageSessionId = generateUUID();
    var pageTurnId = 0;
    createNewChatHistoryDiv();

    collapseBtn.addEventListener('click', function() {
        sidebar.classList.toggle('collapsed');
    });
    
    searchInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    const messageTypeIncoming = "bot-message";
    const messageTypeOutgoing = "user-message";

    function generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (crypto.getRandomValues(new Uint8Array(1))[0] % 16) | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }

    function appendMessage(id, role, message_type, section, content, template) {
        msgDiv = document.getElementById(id);
        if (msgDiv == null) {
            msgDiv = document.createElement('div');
            msgDiv.id = id;
            msgDiv.className = `message ${role} ${message_type}`;
            chatbox.appendChild(msgDiv);
        }
        if (role === 'assistant' && content.match(/^<img src=/)) {
            // If the content is an image tag, render as HTML
            msgDiv.innerHTML = content;
        } else {
            msgDiv.textContent = content;
        }
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    function appendMessageHtml(id, role, message_type, section, content, template) {
        try {
            msgDiv = document.getElementById(id);
            if (msgDiv == null) {
                // wrapper
                state = messageStates.get(id);
                msgDiv = createDivByTemplate(template, state);
                if (msgDiv) {
                    msgDiv.id = id;
                    const baseClassName = `message ${role} ${message_type}`;
                    msgDiv.className = msgDiv.className ? `${baseClassName} ${msgDiv.className}` : baseClassName;

                    updateMessageDivByContent(template, msgDiv, section, content);
                    chatbox.appendChild(msgDiv);
                }
            }
            updateMessageDivByContent(template, msgDiv, section, content);
            chatbox.scrollTop = chatbox.scrollHeight;
        } catch (err) {
            console.log(err)
        } finally {
            //
        }
    }

    /**
    * Add Click Event to Rendered Element in Html
    */
    function addEventListenerDynamicButton(buttonElement, actionName) {
        if (buttonElement == null) {
            return;
        }
        buttonElement.addEventListener('click', () => {
                clickButtonAction(actionName); 
            }
        );
        buttonElement.setAttribute("set_on_click", true);
        console.log(buttonElement)
    }

    function createDivByTemplate(template, state) {

        if (template == "reason_html") {
            return createNewReasonHtmlDiv()
        
        } else if (template == "reason_text") {
            
            return createNewReasonTextDiv();
        
        } else if (template == "multi_tab_message") {
            // multi-tab to fill multiple messages
            return createNewMultiTabHtmlDiv(state);
        } else {
            return createNewReasonTextDiv();

        }

    }

    /**
    * iframe has isolated html and js action are not good
    */
    function updateMessageDivByContent(template, div, section, content) {
        if (template == "reason_html") {
            var divList = div.getElementsByClassName(section);
            if (divList != null) {
                // update the first match div
                for (var i = 0; i < divList.length; i++) {
                    // find iframe that classlist match section
                    if (divList[i].classList.contains(section)) {
                            divList[i].innerHTML = content;
                    }
                }
            }

        } else if (template == "reason_text") {
            // section: think, tools, answer
            var divList = div.getElementsByClassName(section);
            if (divList != null) {
                // update the first match div
                for (var i = 0; i < divList.length; i++) {
                    // find iframe that classlist match section
                    if (divList[i].classList.contains(section)) {
                        divList[i].textContent = content;
                    }
                }
            } 
        } else {

        }

    }

    /**
    *
    */
    function createNewReasonHtmlDiv() {

        let msgDiv = document.createElement('div');

        let divSystemMsg = document.createElement('div');
        divSystemMsg.className = "system_msg";

        let divReason = document.createElement('div');
        divReason.className = "think";

        let divTool = document.createElement('div');
        divTool.className = "tool";

        let divHtml = document.createElement('div');
        divHtml.className = "answer";

        let divContext = document.createElement('div');
        divContext.className = "context";
        divContext.style.display = "none";
        // divContext.style.visibility = "hidden";

        msgDiv.appendChild(divSystemMsg);
        msgDiv.appendChild(divReason);
        msgDiv.appendChild(divTool);
        msgDiv.appendChild(divHtml);
        msgDiv.appendChild(divContext);

        return msgDiv;
    }

    /**
     * 创建 多TAB的html的div
     * */
    function createNewMultiTabHtmlDiv(state) {
        if (state == null) {
            return document.createElement('div');
        }
        try {
            // create navigation
            let msgDiv = document.createElement('div');

            var tabMessageIds = state?.tabMessageIds ?? "";
            if (tabMessageIds == "") {
                return msgDiv;
            }
            // "," separated
            var tabMessagesIdList = tabMessageIds.split(",");

            // multi agent dummy message Id
            var multiTabMessageId = state?.messageId ?? "";
            msgDiv.id = multiTabMessageId;
            msgDiv.className = `message-multi-tab`;

            let tabNav = document.createElement('ul');
            tabNav.className = "tab-nav";
            tabNav.role = "tablist";
            // create banner
            for (var i = 0; i < tabMessagesIdList.length; i++) {
                let tabLi = document.createElement('li');
                var tabId = `${multiTabMessageId}-tab-${i}`;
                if (i == 0) {
                    tabLi.innerHTML = `<button class="tab-button active" role="tab" aria-selected="true" data-tab="${tabId}">
                            <div class="avatar-icon">T${i}</div>
                            <span>Task ${i}</span>
                        </button>`
                } else {
                    tabLi.innerHTML = `<button class="tab-button" role="tab" aria-selected="false" data-tab="${multiTabMessageId}-tab-${i}">
                            <div class="avatar-icon">T${i}</div>
                            <span>Task ${i}</span>
                        </button>`
                }
                tabNav.appendChild(tabLi);
            }
            // add navigation bar
            msgDiv.appendChild(tabNav);

            // create content tab
            for (var i = 0; i < tabMessagesIdList.length; i++) {
                var tabId = `${multiTabMessageId}-tab-${i}`;
                var tabMessageId = tabMessagesIdList[i];
                let tabContent = document.createElement('div');
                tabContent.id = tabId;
                tabContent.className = (i == 0)?'tab-content active':'tab-content';
                tabContent.role = 'tabpanel';

                // create a new content type streaming div
                let tabMessageDiv = createNewReasonHtmlDiv();
                tabMessageDiv.id = tabMessageId;
                tabMessageDiv.className = 'message assistant bot-message';
                // add message div to a tab content wrapper
                tabContent.appendChild(tabMessageDiv);

                msgDiv.appendChild(tabContent);
            }

            return msgDiv;
        } catch (err) {
            console.error(`Failed to createNewMultiTabHtmlDiv with error ${err}`);
            return document.createElement('div');
        }
    }

    /**
    * 
    */
    function createNewReasonTextDiv() {

        let msgDiv = document.createElement('div');

        let divSystemMsg = document.createElement('div');
        divSystemMsg.className = "system_msg";

        let divReason = document.createElement('div');
        divReason.className = "think";

        let divTool = document.createElement('div');
        divTool.className = "tool";

        let divText = document.createElement('div');
        divText.className = "answer";

        let divContext = document.createElement('div');
        divContext.className = "context";
        // divContext.style.hidden = "hidden";
        // divContext.style.visibility = "hidden";
        divContext.style.display = "none";

        // divToolResult = document.createElement('div');
        // divToolResult.className = "tool";
        msgDiv.appendChild(divSystemMsg);
        msgDiv.appendChild(divReason);
        msgDiv.appendChild(divTool);
        msgDiv.appendChild(divText);
        msgDiv.appendChild(divContext);
        // msgDiv.appendChild(divToolResult);    
        return msgDiv;    
    }

    function appendSystemMessage(msg) {
        systemMessages.textContent = msg;
    }

    /**
    * messagesHistory: list
    */
    function getWorkflowSelected() {

        try {
            var button = document.getElementById("workflowBtn");
            var value = button.getAttribute('data-value');
            return value;
        } catch (err) {
            console.log(err);
            return "";
        }
    }

    function getServerIdsFromURL() {
        try {
            // Get Server Ids From URL
            const params = new URLSearchParams(window.location.search);
            var server_ids = params.get("server")
            if (server_ids == null) {
                server_ids = getMcpServerOwnerRepoFromURL();
            }
            return server_ids
        } catch (err) {
            console.log(err)
            return ""
        }
    }

    function getAgentIdsFromURL() {
        try {
            // Get Server Ids From URL
            const params = new URLSearchParams(window.location.search);
            var agent_ids = params.get("agent")
            if (agent_ids == null) {
                // 第二种获取Agent,固定 URL Pattern,  /agent/owner_id/repo_id
                agent_ids = getAgentOwnerRepoFromURL();
            }
            return agent_ids
        } catch (err) {
            console.log(err)
            return ""
        }
    }

    function getActiveSessionId() {
        try {
            var session_id = "";
            var dialogueSessionId  = document.getElementById("dialogue_session_id");
            if (dialogueSessionId != null) {
                session_id = dialogueSessionId.text;
            }
            return session_id;
        } catch (err) {
            console.log(err)
            return "";
        }
    }

    function setPageSessionId(sessionId) {
        try {
            var dialogueSessionId  = document.getElementById("dialogue_session_id");
            if (dialogueSessionId != null) {
                dialogueSessionId.innerText = sessionId;
            }
        } catch (err) {
            console.log(err)
        }
    }

    
    function getActiveUserId() {
        try {
            var user_id = "";
            var dialogueUserId  = document.getElementById("dialogue_user_id");
            if (dialogueUserId != null) {
                user_id = dialogueUserId.text;
            }
            return user_id;
        } catch (err) {
            console.log(err)
            return "";
        }
    }
    
    function getActiveUserGroup() {
        try {
            var userGroup = "";
            var dialogueUserGroup  = document.getElementById("dialogue_user_group");
            if (dialogueUserGroup != null) {
                userGroup = dialogueUserGroup.text;
            }
            return userGroup;
        } catch (err) {
            console.log(err)
            return "";
        }
    }

    function getActiveTurnId() {
        try {
            var turnId = 0;
            var dialogueTurnId  = document.getElementById("dialogue_turn_id");
            if (dialogueTurnId != null) {
                var turnIdText = dialogueTurnId.text;
                turnId = parseInt(turnIdText);
            }
            return turnId;
        } catch (err) {
            console.log(err)
            return 0;
        }
    }

    function setPageTurnId(turnId) {
        try {
            var dialogueTurnId  = document.getElementById("dialogue_turn_id");
            if (dialogueTurnId != null) {
                dialogueTurnId.innerText = turnId;
            }
        } catch (err) {
            console.log(err)
        }
    }

    function updateNewSessionId() {
        try {
            var sessionId = generateUUID();
            var dialogueSessionId  = document.getElementById("dialogue_session_id");
            if (dialogueSessionId != null) {
                dialogueSessionId.innerHTML = sessionId;
            }
        } catch (err) {
            console.log(err);
        }
    }

    async function waitForAllMessages(messageIds) {
        return new Promise((resolve) => {
            const checkAllCompleted = () => {
                const allDone = messageIds.every(id => {
                    const state = messageStates.get(id);
                    return state && state.isFinished;
                });
                
                if (allDone) resolve();
                else setTimeout(checkAllCompleted, 100);
            };
            checkAllCompleted();
        });
    }

    async function processStream(reader, decoder) {
        let done = false;
        let buffer = "";
        var messageIdTotal = [];

        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            
            if (value) {
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;
                // Router According to Chunk
                var curMessageIdList = processBufferContentType(buffer);

                messageIdTotal = messageIdTotal.concat(curMessageIdList);
                buffer = "";
            }
        }
        
        if (buffer) {
            var curMessageIdList = processBufferContentType(buffer);
            messageIdTotal = messageIdTotal.concat(curMessageIdList);
        };
        messageIdTotal = [...new Set(messageIdTotal)]; 

        removeCursor(document);
        messageIdTotal.forEach(messageId => {
            state = messageStates.get(messageId);
            if (state != null && state.displayedContent != "") {
                state.messageDisplayedContent += state.displayedContent;
                state.displayedContent = "";
            }
        });

        // add Tool Bar
        messageIdTotal.forEach(messageId => {
            addToolBarToMessage(messageId);
        });

        // append chat history, const chatHistory[]
        appendChatHistory(messageIdTotal);

        return messageIdTotal;

    }

    function addToolBarToMessage(messageId) {

        try {
            const msgDiv = document.getElementById(messageId);
            if (!msgDiv) return;

            const existToolBar = msgDiv.querySelector(".agent-chat-conv-ai-toolbar");
            if (existToolBar) {
                return;
            }
            const toolbarDiv = document.createElement('div');
            toolbarDiv.classList.add('agent-chat-conv-ai-toolbar');
            toolbarDiv.innerHTML = `
                    <div class="agent-chat-conv-ai-toolbar">
                        <div class="agent-chat-toolbar agent-chat-toolbar_new">
                            <div class="agent-chat-toolbar-item agent-chat-toolbar-copy">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M8 16H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v2"/>
                                    <rect x="8" y="8" width="10" height="12" rx="2"/>
                                </svg>
                                <span class="tooltip">Copy</span>
                            </div>
                            
                            <div class="agent-chat-toolbar-item agent-chat-toolbar-like">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                                </svg>
                                <span class="tooltip">Upvote</span>
                            </div>
                            
                            <div class="agent-chat-toolbar-item agent-chat-toolbar-dislike">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <path d="M10 15v4a3 3 0 0 0 3 3l4-9V3H6.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3zm7-13h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/>
                                </svg>
                                <span class="tooltip">Downvote</span>
                            </div>
                            
                            <div class="agent-chat-toolbar-item agent-chat-toolbar-share">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                    <circle cx="18" cy="5" r="3"/>
                                    <circle cx="6" cy="12" r="3"/>
                                    <circle cx="18" cy="19" r="3"/>
                                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                                </svg>
                                <span class="tooltip">Share</span>
                            </div>
                        </div>
                    </div>
            `;
            msgDiv.appendChild(toolbarDiv);

        } catch (err) {
            console.log(err);
        }
    }

    /**
    * Fetch message information from div and post API
    */
    function addAssistantMessageRestAPI(messageIdList) {

        try {
            messageIdList.forEach(messageId => {
                // temp no server generated messageId
                if (!messageId.startsWith("msg-")) {
                    var msgHtmlDisplayElem = document.getElementById(messageId);
                    var msgHtmlDisplayHtml = (msgHtmlDisplayElem != null)?msgHtmlDisplayElem.innerHTML: "";
                    if (msgHtmlDisplayHtml != "") {
                        var messageJson = {
                            "session_id": getActiveSessionId(),
                            "msg_id": messageId,
                            "sender_id": getActiveUserId(),
                            "content": msgHtmlDisplayHtml,
                            "role": messageRoleAssistant,
                            "turn_id": getActiveTurnId(),
                            "status": "1"
                        }

                        // display
                        fetch(productionUrlPrefix + '/message/add', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(messageJson)
                        }).then(response => response.json())
                        .then(data => {
                            // console.log('Add Message Successfully:', data);
                        })
                        .catch(error => {
                            console.error('Add Message Failed:', error);
                        });
                    }
                }
            });

        } catch (err) {
            console.log(err);
        }
    }

    /**
    * Only Keep Content and LLM Output in the Message, Not the Wrapper HTML
    */
    function appendChatHistory(messageIdList) {
        messageIdList.forEach(messageId => {
            var messageState = messageStates.get(messageId);
            if (messageState != null) {
                // Two Different Card Content State Tracking
                if (messageState.messageDisplayedContent != "") {
                    // add response message
                    chatHistory.push({role: 'assistant', content: messageState.messageDisplayedContent});
                } else {
                    // add response message
                    // post to next API Call
                    var contentMap = messageState.sectionContentMap;
                        if (contentMap != null) {
                        var thinkVar = contentMap.get("think").display;
                        var toolVar = contentMap.get("tool").display;
                        var answerVar = contentMap.get("answer").display;
                        var systemMessageVar = contentMap.get("system_msg").display;
                        var contextVar = contentMap.get("context").display;

                        var mergeNonEmptyList = [];
                        if (thinkVar != "") mergeNonEmptyList.push(thinkVar);
                        if (toolVar != "") mergeNonEmptyList.push(toolVar);
                        if (answerVar != "") mergeNonEmptyList.push(answerVar);
                        if (systemMessageVar != "") mergeNonEmptyList.push(systemMessageVar);

                        var msgSummary = mergeNonEmptyList.join("|");
                        var allEmpty = ([thinkVar, toolVar, answerVar, contextVar, systemMessageVar].join("") == "")
                        if (!allEmpty) {
                            chatHistory.push({role: 'assistant', content: msgSummary, id: messageId, context: contextVar});
                        }
                    }
                }
            }
        });
    }

    function processBuffer(buffer) {

        var messageIdList = [];

        buffer.split('\n').forEach(line => {
            if (!line.trim()) return;
            try {
                const data = JSON.parse(line);
                const messageId = data.message_id || `msg-${Date.now()}`;
                
                if (!messageIdList.includes(messageId)) {
                    messageIdList.push(messageId);
                }

                // system, assistant
                const dataType = data.type;
                // image, video, html, text
                const dataFormat = data?.format ?? "";
                // system_msg, think, tool, answer, context
                const dataSection = data?.section ?? "";
                const dataContent = data?.content ?? "";
                // template: reason_html: reason+tool+answer, reason_text: reason + answer, others
                const dataTemplate = data?.template ?? "reason_html";
                // template: multi
                const dataTabId = data?.tab_id ?? 0;
                const dataTabCnt = data?.tab_count ?? 0;

                if (!messageStates.has(messageId)) {
                    messageStates.set(messageId, {
                        messageId,
                        messageDisplayedContent: '', // displayed content for the whole message, list of section-container
                        displayedContent: '',      // displayed content for the section-container, [..displayedContent]
                        pendingContent: '',
                        isFinished: false,
                        sectionContentMap: new Map([
                            ["system_msg", {pending: "", display:""}],
                            ["think", {pending: "", display:""}],
                            ["tool", {pending: "", display:""}],
                            ["answer", {pending: "", display:""}],
                            ["context", {pending: "", display:""}]
                        ]),
                        template: dataTemplate,
                        timer: null,
                        tabId: dataTabId,
                        tabCount: dataTabCnt
                    });
                }

                // update message States
                const state = messageStates.get(messageId);
                var curSectionContent = state.sectionContentMap.get(dataSection);
                if (curSectionContent != null) {
                    curSectionContent.pending += dataContent;
                }

                updateMessageDOM(state);

            } catch (err) {
                console.error(`process error: ${err}`);
                appendSystemMessage('Failed to process Error...');
            }
        });

        // Last Pending Content
        updateMessageDOM(state);

        return messageIdList;
    }


    /**
    * Set Front End According to Different Content Type
    **/
    function processBufferContentType(buffer) {

        var messageIdList = [];

        buffer.split('\n').forEach(line => {
            if (!line.trim()) return;
            try {
                const data = JSON.parse(line);
                // const messageId = data.message_id || `msg-${Date.now()}`;
                const messageId = data.message_id;
                // if message id is empty, return, remove default value, avoid display empty message
                if (!messageId) {
                    // console.log("Current Chunk Line Empty or Missing message Id|" + line);
                    return;
                }
                if (!messageIdList.includes(messageId)) {
                    messageIdList.push(messageId);
                }
                // system, assistant
                const dataType = data.type;
                // image, video, html, text
                const dataFormat = data?.format ?? "";
                // system_msg, think, tool, answer, context
                const dataSection = data?.section ?? "";
                const dataContent = data?.content ?? "";
                // template: reason_html: reason+tool+answer, reason_text: reason + answer, others
                const dataTemplate = data?.template ?? "reason_html";
                const dataContentType = data?.content_type ?? "";
                const dataMessageIds = data?.tab_message_ids ?? 0;

                if (!messageStates.has(messageId)) {

                    // create new message state
                    messageStates.set(messageId, {
                        messageId,
                        messageDisplayedContent: '', 
                        displayedContent: '',  // .message.segment level
                        pendingContent: '',   // .message.segment level
                        isFinished: false,
                        // create new div under the messages
                        existContentType: null,  // the streaming current content_type flah
                        contentType: null, // track of latest batch of json data
                        sectionContentMap: new Map([
                            ["system_msg", {pending: "", display:""}],
                            ["think", {pending: "", display:""}],
                            ["tool", {pending: "", display:""}],
                            ["answer", {pending: "", display:""}],
                            ["context", {pending: "", display:""}]
                        ]),
                        template: dataTemplate,
                        tabMessageIds: dataMessageIds,
                        timer: null,
                    });
                }

                // update message States
                const state = messageStates.get(messageId);

                // update content
                state.pendingContent += dataContent;
                state.contentType = dataContentType;
                // update section content 
                var curSectionContent = state.sectionContentMap.get(dataSection);
                if (curSectionContent != null) {
                    curSectionContent.pending += dataContent;
                }

                updateMessageDOM(state);

            } catch (err) {
                console.error(`process error: ${err}`);
                appendSystemMessage('Failed to process Error...');
            }
        });

        return messageIdList;
    }

    /**
    * display text in a paragraph with \r\n break lines
    */
    function formatTextWithParagraphs(text, div_class) {
        if (text == null || text.trim() == "") {
            return '';
        }
        try {
            var lineList = text.split(/\r\n|\r|\n/);
            var wrappedParagraphDivList = "";
            if (lineList != null) {
                wrappedParagraphDivList = lineList.map(line => {
                    const hasHtmlTags = /<\/?[a-zA-Z][\s\S]*?>/i.test(line);
                    if (!hasHtmlTags) {
                        return line.trim() ? `<p>${line}</p>` : ''
                    } else {
                        return line.trim() ? `${line}` : ''
                    }
                }).join('');
            }
            var wraperContent = `<div class="${div_class}">` + wrappedParagraphDivList + '</div>';
            return wraperContent;
        } catch (err) {
            console.log(err)
            return text;
        }
    }



    /**
     * 更新 MessageDom
     * */
    function updateMessageDOMMultiTabTemplate(state, messageId) {
        try {




        } catch (err) {

        }
    }


    /**
    *
    */
    function updateMessageDOMHtmlTemplate(state, messageId) {

            const existContentType = state.existContentType;
            const contentType = state.contentType;
            const curMessageDiv = document.getElementById(messageId);

            // 2.0 update Reasoning Content and Tool Template update message unfinished
            var existingPendingContent = "";
            if (state.sectionContentMap != null) {
                state.sectionContentMap.forEach(function(value, key) {
                    existingPendingContent += value.pending.trim();
                })
            }
            if (existingPendingContent.trim().length === 0) {
                return;
            }        
            state.sectionContentMap.forEach(function(value, key) {
                var curSection = key;
                var curPendingContent = value.pending;
                var curDisplayContent = value.display;
                if (curPendingContent == "") {
                    return;
                }

                var curSectionElement  = curMessageDiv.querySelector(`.${curSection}`)
                // append pendding to display and clear pending
                if (curSection == "system_msg") {
                    // update State
                    value.display = curPendingContent;
                    value.pending = "";
                    curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");

                } else if (curSection == "think" || curSection == "context") {

                    value.display += curPendingContent;
                    value.pending = "";
                    curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");

                } else if (curSection == "tool") {
                    // content_type="tool_result", append to previous section, otherwise add new
                    if (contentType === "tool/tool_result") {
                        const resultSection = curSectionElement.querySelector(".results-section");
                        if (resultSection) {
                            var divToolCallJsonResult = resultSection.querySelector(".div_tool_call_json");
                            if (divToolCallJsonResult) {
                                divToolCallJsonResult.innerHTML = curPendingContent;
                            }

                        }
                    } else {
                        value.display += curPendingContent;
                        value.pending = "";
                        curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");
                    }
                } else if (curSection == "answer") {
                    // markdown and html
                    value.display += curPendingContent;
                    value.pending = "";
                    try {
                        setTimeout(() => {
                            curSectionElement.innerHTML = marked.parse(value.display);
                        }, MARKDOWN_RENDER_DELAY);
                    } catch (err) {
                        console.log(err);
                        curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");
                    }

                } else if (curSection == "context") {

                    value.display += curPendingContent;
                    value.pending = "";

                    curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");

                } else {
                    curDisplayContent += curPendingContent;

                    value.pending = "";
                    value.display = curDisplayContent;

                    curSectionElement.innerHTML = formatTextWithParagraphs(value.display, "div_msg_paragraph");

                }
            })
    }

    /**
    * post process the result tagged lines to a list
    * <img></img> <file_path></file_path>
    */
    function extractAllContentsListByTagMerge(content) {
        if (content == null || content == "") {
            return [];
        }
        var result_list = extractAllContentsListByTag(content, "<url>", "</url>")
                .concat(extractAllContentsListByTag(content, "<file_path>", "</file_path>"))
                .concat(extractAllContentsListByTag(content, "<img>", "</img>"))
                .concat(extractAllContentsListByTag(content, "<audio>", "</audio>"))
                .concat(extractAllContentsListByTag(content, "<video>", "</video>"))
                .concat(extractAllContentsListByTag(content, "<iframe>", "</iframe>"))
                .concat(extractAllContentsListByTag(content, "<media>", "</media>"));
        return result_list;
    }

    /**
    * content: text 
    * tag_prefix: <tag_a>
    * tag_postfix: </tag_a>
    */
    function extractAllContentsListByTag(content, tag_prefix, tag_postfix) {
        try {
            const escapeRegExp = str => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const escapedPrefix = escapeRegExp(tag_prefix);
            const escapedPostfix = escapeRegExp(tag_postfix);

            const regex = new RegExp(`${escapedPrefix}(.*?)${escapedPostfix}`, 'gs');
            const matches = [];
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                matches.push(match[1]);
            }
            return matches;
        } catch (err) {
            return [];
        }
    }

    /**
    * content: text 
    # <img src="http://ts1.mm.bing.net/th?id=OIP.i8Rm1j_1SDRelghPsZtu1gHaL4&pid=15.1" alt="The church of Christ the King in Messina on the island of Sicily, Italy" />
    # <img src="http://ts3.mm.bing.net/th?id=OIP.px3t4JBOEo6NIsSFgZxU_gHaL1&pid=15.1" alt="Palermo Cathedral, Sicily Island In Italy. Famous Church." />
    * tag="img"
    * [{src: '', alt:111}, {src: '', alt:111}]
    */
    function extractAllContentsListByHtmlTagExtended(content, tag, attributes = ['src', 'alt']) {
        try {
            const escapedTag = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const tagRegex = new RegExp(`<${escapedTag}[^>]*>`, 'gi');
            const tagMatches = content.match(tagRegex);
            
            if (!tagMatches) return [];
            
            return tagMatches.map(tagMatch => {
                const result = {};
                attributes.forEach(attr => {
                    const attrMatch = tagMatch.match(new RegExp(`\\s${attr}\\s*=\\s*["']([^"']*)["']`, 'i'));
                    result[attr] = attrMatch ? attrMatch[1] : '';
                });
                return result;
            });
            
        } catch (err) {
            console.error('Failed to Extract Images:', err);
            return [];
        }
    }

    function loadIFrameFallback(elem) {
        try {
            src = elem?.src;
            console.error(`iframe ${src} loading failed`);
            elem?.classList.add('iframe-fallback');
        } catch (err) {
            console.error(err);
        }
    }


    /**
    * filePath <file_path>xxxx</file_path>
    */
    function generateDataFileURL(filePath) {
        try {
            var absoluateUrl = false;
            if (filePath.includes("http://") || filePath.includes("https://")) {
                absoluateUrl = true;
            }
            if (absoluateUrl) {
                return filePath;
            } else {
            }
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    /***
    * fileFullName: Full Name With Extension
    * fileURL: URL For Visiting the File (Generated From Absolute Path)
     *
     * fileFullName can be file or a folder
     * fileFullName:  /b472e386-216f-4d75-80ac-c7b3d8ca6626/ 当前session文件目录
     * fileFullName:  7896.xls
     *
     * fileURL: /files-wd/preview/user_9131/6e66b406-f967-4bbb-b623-8ec955623917/85ec_temp.xlsx
     * filePath: /files-wd/user_9131/6e66b406-f967-4bbb-b623-8ec955623917/85ec_temp.xlsx
    */
    function generateFileAndMediaDisplayHtml(fileFullName, fileURL, filePath = "") {
        var curHtml = "";
        if (fileFullName == null || fileURL == null) {
            return curHtml;
        }
        try {
                                // file_name.extension  or file_name
                                // var fileNameArray = fileFullName.split(".");
                                // // console.log(`Processing fileNameArray ${fileNameArray}`);
                                //
                                // var fileNameExtension = "";
                                // var fileName = "";
                                // if (fileNameArray.length >= 2) {
                                //     fileNameExtension = fileNameArray[fileNameArray.length - 1];
                                //     fileName = fileFullName.replace("." + fileNameExtension, "");
                                // } else if (fileNameArray.length == 1) {
                                //     // no extension or folder
                                //     fileNameExtension = "";
                                //     fileName = fileNameArray[0];
                                // }
                                var fileNameExtension = getFileNameExtension(fileFullName);
                                // console.log(`Processing fileNameArray fileName ${fileName}`);
                                // JS generate safe share url for absolute path
                                // var fileURL = filePath;
                                // render different file extension
                                if (fileNameExtension == ".xls" || fileNameExtension == ".xlsx" || fileURL.includes("/xls")) {
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="xlsx">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/excel-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else if (fileNameExtension == ".doc" || fileNameExtension == ".docx" || fileURL.includes("/doc")) {
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="docx">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/word-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else if (fileNameExtension == ".ppt" || fileNameExtension == ".pptx" || fileURL.includes("/ppt")) {
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="pptx">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/powerpoint-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else if (fileNameExtension == ".pdf" || fileURL.includes("/pdf")) {
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="pdf">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/pdf-file-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else if (fileNameExtension == ".txt" || fileNameExtension == ".md" || fileNameExtension == ".json"){
                                    // 后缀不支持
                                    var fileType = fileNameExtension.replace(".", "");
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="${fileType}">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/general-file-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else if (validImageExtensionList.includes(fileNameExtension)) {
                                    // image
                                    curHtml = generateMediaDisplayHtml(fileURL, "image");
                                } else if (validVideoExtensionList.includes(fileNameExtension)) {
                                    // video
                                    curHtml = generateMediaDisplayHtml(fileURL, "video");
                                } else if (validAudioExtensionList.includes(fileNameExtension)) {
                                    // audio
                                    curHtml = generateMediaDisplayHtml(fileURL, "audio");
                                } else if (fileNameExtension == "") {
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="folder">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/folder-icon.webp"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                } else {
                                    var fileType = fileNameExtension.replace(".", "");
                                    // 后缀不支持
                                    curHtml = `
                                        <div class="message_file_display_wrapper" data-file-name="${fileFullName}" data-file-url="${fileURL}" data-file-path="${filePath}" data-file-type="${fileType}">
                                            <div class="file_display_icon_wrapper">
                                                <img class="file_display_icon" src="/static/img/general-file-icon-transparent.png"></img>
                                            </div>
                                            <div>
                                                <span class="file-name">${fileFullName}</span>
                                            </div>
                                        </div>
                                    `;
                                }
            return curHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }



    /**
    * Render All Returned Content
    */
    function displayHtmlByRenderingContent(state, messageId) {

            const existContentType = state.existContentType;
            // content type of new data batch
            const contentType = state.contentType;
            const messageRole = "assistant";


            const curMessageDiv = null;

            let currentSegment = null;
            let currentLanguage = "";

            
            // renderred html
            const renderedHtml = "";


            if (contentType === 'text/markdown') {
                const mdContainer = currentSegment.querySelector('.markdown-content');
                if (mdContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        mdContainer.innerHTML = marked.parse((state.displayedContent || ''));
                }
            } else if (contentType === 'application/code') {
                    const codeElement = currentSegment.querySelector('code');
                    if (codeElement) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // highlight code
                        codeElement.textContent = state.displayedContent;
                        if (window.Prism) {
                            Prism.highlightElement(codeElement);
                        }
                    }
                  } else if (contentType === 'text/html') {
                    const htmlContainer = currentSegment.querySelector('.html-content');
                    if (htmlContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        htmlContainer.innerHTML = state.displayedContent;
                    }
                  } else if (contentType === 'image/*') {

                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        // 
                        var mergeHtml = "";
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "image");
                                mergeHtml += curHtml;
                            })
                        }
                        // returned images in standard image format
                        // <img src="http://ts1.mm.bing.net/th?id=OIP.i8Rm1j_1SDRelghPsZtu1gHaL4&pid=15.1" alt="The church of Christ the King in Messina on the island of Sicily, Italy" />
                        // <img src="http://ts2.mm.bing.net/th?id=OIP.OfHStKX8Y1rPBvjvT-mM5AHaEl&pid=15.1" alt="Palermo Church Front editorial stock image" />
                        const imageFetchedResult = extractAllContentsListByHtmlTagExtended(state.displayedContent, 'img', ['src', 'alt', 'class']);
                        if (imageFetchedResult) {
                            imageFetchedResult.forEach(
                                imgJson => {
                                    var src = imgJson.src;
                                    var alt = imgJson.alt;
                                    if (src != null & alt != null) {
                                        var curHtml = generateMediaDisplayHtmlWithAlt(src, "image", alt);
                                        mergeHtml += curHtml;
                                    }
                                }
                            )
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                    // start async verify if image is valid

                  } else if (contentType === 'video/*') {

                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "video");
                                mergeHtml += curHtml;
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'audio/*') {

                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);                        //
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "audio");
                                mergeHtml += curHtml;
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'iframe/*') {

                    const container = currentSegment.querySelector('.iframe-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        //
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateIframeDisplayHtml(src);
                                mergeHtml += (curHtml);
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'application/pdf' || contentType === 'application/office') {

                    const container = currentSegment.querySelector('.file-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content
                        var filePathList = extractAllContentsListByTagMerge(state.displayedContent);
                        //
                        var mergeHtml = "";
                        if (filePathList) {
                            // absolute path for MCP Tool mannipulation
                            filePathList.forEach(filePath => {
                                if (filePath == null || filePath == "") {
                                    return;
                                }
                                // console.log(`Processing filePath ${filePath}`);
                                var filePathNameArray = filePath.split("/");
                                if (filePathNameArray.length == 0) {
                                    return;
                                }
                                var fileFullName = filePathNameArray[filePathNameArray.length - 1];
                                // console.log(`Processing filePath fileFullName ${fileFullName}`);
                                if (fileFullName == "") {
                                    return;
                                }
                                // filePath can be local server path or remote path
                                var fileURL = generateDataFileURL(filePath);
                                var curHtml = generateFileAndMediaDisplayHtml(fileFullName, fileURL, filePath);
                                if (curHtml != "") {
                                    mergeHtml += (curHtml);
                                }
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }
                  } else {
                    // default to html
                    const htmlContainer = currentSegment.querySelector('.html-content');
                    if (htmlContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        htmlContainer.innerHTML = state.displayedContent;
                    }
                  }
                  // add New Cursor Span
                  // cursorSpan = document.createElement('span');
                  // cursorSpan.className = 'typing-cursor';     
                  // if (cursorSpan) {
                  //   currentSegment.appendChild(cursorSpan);
                  // }
                  addCursor(currentSegment);



    }

    function executeDynamicScripts(targetContainer) {
        // 1. Get all script nodes from the container
        const scripts = targetContainer.querySelectorAll('script');

        // 2. Separate external and inline scripts
        const externalScripts = Array.from(scripts).filter(s => s.src);
        const inlineScripts = Array.from(scripts).filter(s => !s.src && s.textContent);

        // 3. Define the function to run the inline scripts (must be defined here to be callable)
        const runInlineScripts = (index = 0) => {
            if (index >= inlineScripts.length) {
                console.log("All inline scripts executed.");
                // Assuming addNavigationLogic() is defined elsewhere on your page
                if (typeof addNavigationLogic === 'function') {
                    addNavigationLogic();
                }
                return;
            }

            const oldScript = inlineScripts[index];
            const newScript = document.createElement('script');

            // Use the same text content
            newScript.textContent = oldScript.textContent;
            targetContainer.appendChild(newScript);

            console.log(`Inline script ${index + 1} executed.`);

            // Execute the next inline script
            runInlineScripts(index + 1);
        };

        // --- EXECUTION START ---

        if (externalScripts.length > 0) {
            // A. Load External Scripts (e.g., Stripe SDK)
            const externalScript = externalScripts[0]; // Assuming only one external script for simplicity
            const newExternalScript = document.createElement('script');

            // Copy attributes like src
            newExternalScript.src = externalScript.src;

            // Wait for the external script to load
            newExternalScript.onload = () => {
                console.log("External script (e.g., Stripe SDK) loaded. Starting inline scripts...");
                // B. Execute all dependent inline scripts
                runInlineScripts();
            };

            // C. Handle error if external script fails to load
            newExternalScript.onerror = () => {
                 console.error(`Failed to load external script: ${externalScript.src}`);
            }

            // Append the new, load-waiting script
            document.head.appendChild(newExternalScript);

            // Remove the original scripts to prevent double execution if the browser loads them
            scripts.forEach(s => s.remove());

        } else {
            // If no external scripts, run inline scripts immediately
            runInlineScripts();
        }
    }


    /**
    * 默认: 固定 div 模板
    * 一个 messageId 下可以有多个组合的 content_type对应的div
    */
    function updateMessageDOMStreamingContentType(state, messageId) {

            const existContentType = state.existContentType;
            // content type of new data batch
            const contentType = state.contentType;
            const messageRole = "assistant";
            const curMessageDiv = document.getElementById(messageId);

            let currentSegment = null;
            let currentLanguage = "";

            // 1.0 Check If New Message or New ContentType in the Message

            // create new div content type, class: .message .segment-container .markdown-content/.code-block
            if (contentType != existContentType) {

                currentSegment = document.createElement('div');
                currentSegment.className = 'segment-container';
                curMessageDiv.appendChild(currentSegment);

                if (contentType == "text/markdown") {
                    const mdDiv = document.createElement('div');
                    mdDiv.className = 'markdown-content';
                    currentSegment.appendChild(mdDiv);
                } else if (contentType == "application/code") {
                    // code header
                    const codeContainer = document.createElement('div');
                    codeContainer.className = 'code-container';

                    const codeHeader = document.createElement('div');
                    codeHeader.className = 'code-header';
                    codeHeader.innerHTML = `
                            <div class="language-label">${currentLanguage}</div>
                            <button class="copy-button" id="copyBtn">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path fill-rule="evenodd" clip-rule="evenodd" d="M6.18563 1.02148H6.27219C7.2371 1.02147 8.02186 1.02145 8.64056 1.10464C9.28576 1.19138 9.83952 1.37836 10.2808 1.81962C10.722 2.26088 10.909 2.81464 10.9958 3.45984C11.013 3.58781 11.0266 3.72289 11.0374 3.8652C11.4689 3.87473 11.8501 3.8954 12.1831 3.94018C12.8283 4.02693 13.3821 4.21391 13.8234 4.65517C14.2646 5.09643 14.4516 5.65018 14.5383 6.29538C14.6215 6.9141 14.6215 7.69882 14.6215 8.66375V10.167C14.6215 11.1319 14.6215 11.9166 14.5383 12.5354C14.4516 13.1806 14.2646 13.7343 13.8234 14.1756C13.3821 14.6168 12.8283 14.8038 12.1831 14.8906C11.5644 14.9737 10.7797 14.9737 9.81476 14.9737H9.72821C8.76328 14.9737 7.97855 14.9737 7.35983 14.8906C6.71463 14.8038 6.16088 14.6168 5.71962 14.1756C5.27836 13.7343 5.09138 13.1806 5.00464 12.5354C4.98743 12.4074 4.97379 12.2723 4.96296 12.13C4.53148 12.1205 4.15032 12.0998 3.81726 12.055C3.17206 11.9683 2.6183 11.7813 2.17704 11.34C1.73578 10.8988 1.5488 10.345 1.46206 9.69981C1.37888 9.0811 1.37889 8.29639 1.37891 7.33148V5.82821C1.37889 4.8633 1.37888 4.07854 1.46206 3.45984C1.5488 2.81464 1.73578 2.26088 2.17704 1.81962C2.6183 1.37836 3.17206 1.19138 3.81726 1.10464C4.43596 1.02145 5.22072 1.02147 6.18563 1.02148ZM4.92325 10.9287C4.92148 10.6885 4.92148 10.4347 4.92148 10.167V8.66375C4.92147 7.69882 4.92145 6.9141 5.00464 6.29538C5.09138 5.65018 5.27836 5.09643 5.71962 4.65517C6.16088 4.21391 6.71463 4.02693 7.35983 3.94018C7.97855 3.857 8.76327 3.85701 9.7282 3.85703H9.81477C9.82079 3.85703 9.82681 3.85703 9.83282 3.85703C9.82532 3.77412 9.8166 3.69516 9.80646 3.61973C9.73761 3.1076 9.61339 2.84929 9.43225 2.66815C9.25111 2.48701 8.9928 2.36279 8.48066 2.29394C7.95127 2.22276 7.24761 2.22149 6.22891 2.22149C5.21021 2.22149 4.50655 2.22276 3.97716 2.29394C3.46502 2.36279 3.20671 2.48701 3.02557 2.66815C2.84443 2.84929 2.72021 3.1076 2.65136 3.61973C2.58018 4.14913 2.57891 4.85279 2.57891 5.87149V7.28816C2.57891 8.30685 2.58018 9.01052 2.65136 9.53991C2.72021 10.052 2.84443 10.3104 3.02557 10.4915C3.20671 10.6726 3.46502 10.7969 3.97716 10.8657C4.24274 10.9014 4.55218 10.9195 4.92325 10.9287ZM6.19393 6.45528C6.26279 5.94314 6.38701 5.68483 6.56815 5.5037C6.74928 5.32256 7.0076 5.19834 7.51973 5.12948C8.04913 5.05831 8.75279 5.05703 9.77149 5.05703C10.7902 5.05703 11.4938 5.05831 12.0232 5.12948C12.5354 5.19834 12.7937 5.32256 12.9748 5.50369C13.156 5.68483 13.2802 5.94314 13.349 6.45528C13.4202 6.98467 13.4215 7.68834 13.4215 8.70703V10.1237C13.4215 11.1424 13.4202 11.8461 13.349 12.3755C13.2802 12.8876 13.156 13.1459 12.9748 13.327C12.7937 13.5082 12.5354 13.6324 12.0232 13.7013C11.4938 13.7724 10.7902 13.7737 9.77149 13.7737C8.75279 13.7737 8.04913 13.7724 7.51973 13.7013C7.0076 13.6324 6.74929 13.5082 6.56815 13.327C6.38701 13.1459 6.26279 12.8876 6.19393 12.3755C6.12276 11.8461 6.12149 11.1424 6.12149 10.1237V8.70704C6.12149 7.68834 6.12276 6.98467 6.19393 6.45528Z" fill="currentColor"></path>
                                </svg>
                                <span>Copy</span>
                            </button>`;
                    codeContainer.appendChild(codeHeader);

                    const pre = document.createElement('pre');
                    pre.className = 'code-block';
                    const code = document.createElement('code');
                    if (currentLanguage) {
                        pre.classList.add(`language-${currentLanguage}`);
                        code.classList.add(`language-${currentLanguage}`);
                    }
                    pre.appendChild(code);
                    codeContainer.appendChild(pre);

                    currentSegment.appendChild(codeContainer);

                } else if (contentType == "iframe/*") {

                    const mdDiv = document.createElement('div');
                    mdDiv.className = 'iframe-container-grid';
                    currentSegment.appendChild(mdDiv);

                } else if (contentType == "image/*" || contentType == "audio/*" || contentType == "video/*") {

                    const mdDiv = document.createElement('div');
                    mdDiv.className = 'media-container-grid';                    
                    currentSegment.appendChild(mdDiv);

                } else if (contentType == "application/pdf") {
                    const mdDiv = document.createElement('div');
                    mdDiv.className = 'file-container-grid';                    
                    currentSegment.appendChild(mdDiv);
                } else if (contentType == "application/office") {
                    const mdDiv = document.createElement('div');
                    mdDiv.className = 'file-container-grid';                    
                    currentSegment.appendChild(mdDiv);
                } else if (contentType == "text/html") {
                    const htmlDiv = document.createElement('div');
                    htmlDiv.className = 'html-content';
                    currentSegment.appendChild(htmlDiv);
                } else if (contentType == "application/javascript") {
                    const jsDiv = document.createElement('div');
                    jsDiv.className = 'js-wrapper';
                    currentSegment.appendChild(jsDiv);
                } else {
                    const htmlDiv = document.createElement('div');
                    htmlDiv.className = 'html-content';
                    currentSegment.appendChild(htmlDiv);
                }

                // remove old cursor from the whole new message
                // const cursorSpan = curMessageDiv.querySelector(".typing-cursor");
                // if (cursorSpan) {
                //     cursorSpan.remove();
                // }
                removeCursor(curMessageDiv);

                // add cursor to new segment
                addCursor(currentSegment);
                // const newCursorSpan = document.createElement('span');
                // newCursorSpan.className = 'typing-cursor';            
                // currentSegment.appendChild(newCursorSpan);

                // switch content type
                state.existContentType = contentType;
                // new segment, clear old displayed content

                // merge All the displatedContent on message level
                state.messageDisplayedContent += state.displayedContent
                state.displayedContent = "";
            }

            // last active Segment of message  .message.segment-container
            currentSegment = curMessageDiv.lastElementChild;


            // append pending content to current segment
            if (currentSegment && contentType) {

                  // const cursorSpan = currentSegment.querySelector(".typing-cursor");
                  // if (cursorSpan != null) {
                  //     cursorSpan.remove();
                  // }
                  // remove cursor
                  removeCursor(currentSegment);
                  
                  if (contentType === 'text/markdown') {
                    const mdContainer = currentSegment.querySelector('.markdown-content');
                    if (mdContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        mdContainer.innerHTML = marked.parse((state.displayedContent || ''));
                    }
                  } else if (contentType === 'application/code') {
                    const codeElement = currentSegment.querySelector('code');
                    if (codeElement) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // highlight code
                        codeElement.textContent = state.displayedContent;
                        if (window.Prism) {
                            Prism.highlightElement(codeElement);
                        }
                    }
                  } else if (contentType === 'text/html') {
                    const htmlContainer = currentSegment.querySelector('.html-content');
                    if (htmlContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        htmlContainer.innerHTML = state.displayedContent;
                    }
                  } else if (contentType === 'application/javascript') {
                    const jsWrapperContainer = currentSegment.querySelector('.js-wrapper');
                    if (jsWrapperContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // update js
                        jsWrapperContainer.innerHTML = state.displayedContent;
                        // execute js container
                        executeDynamicScripts(jsWrapperContainer);
                    }
                  } else if (contentType === 'image/*') {
                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        // 
                        var mergeHtml = "";
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "image");
                                mergeHtml += curHtml;
                            })
                        }
                        // returned images in standaord image format 
                        // <img src="http://ts1.mm.bing.net/th?id=OIP.i8Rm1j_1SDRelghPsZtu1gHaL4&pid=15.1" alt="The church of Christ the King in Messina on the island of Sicily, Italy" />
                        // <img src="http://ts2.mm.bing.net/th?id=OIP.OfHStKX8Y1rPBvjvT-mM5AHaEl&pid=15.1" alt="Palermo Church Front editorial stock image" />
                        const imageFetchedResult = extractAllContentsListByHtmlTagExtended(state.displayedContent, 'img', ['src', 'alt', 'class']);
                        if (imageFetchedResult) {
                            imageFetchedResult.forEach(
                                imgJson => {
                                    var src = imgJson.src;
                                    var alt = imgJson.alt;
                                    if (src != null & alt != null) {
                                        var curHtml = generateMediaDisplayHtmlWithAlt(src, "image", alt);
                                        mergeHtml += curHtml;
                                    }
                                }
                            )
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                    // add image verification on container
                    startImageValidationAfterInsertion(container);

                  } else if (contentType === 'video/*') {

                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTag(state.displayedContent, "<url>", "</url>").concat(
                            extractAllContentsListByTag(state.displayedContent, "<file_path>", "</file_path>"));
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "video");
                                mergeHtml += curHtml;
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'audio/*') {

                    const container = currentSegment.querySelector('.media-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateMediaDisplayHtml(src, "audio");
                                mergeHtml += curHtml;
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'iframe/*') {

                    const container = currentSegment.querySelector('.iframe-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content 
                        var srcList = extractAllContentsListByTagMerge(state.displayedContent);
                        var mergeHtml = "";
                        if (srcList) {
                            srcList.forEach(src => {
                                var curHtml = generateIframeDisplayHtml(src);
                                mergeHtml += (curHtml);
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }

                  } else if (contentType === 'application/pdf' || contentType === 'application/office') {

                    const container = currentSegment.querySelector('.file-container-grid');
                    if (container) {
                        // support multiple picture
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        // render List of Image Content
                        var filePathList = extractAllContentsListByTagMerge(state.displayedContent);
                        var mergeHtml = "";
                        if (filePathList) {
                            // absolute path for MCP Tool manipulation
                            filePathList.forEach(filePath => {
                                if (filePath == null || filePath == "") {
                                    return;
                                }
                                // console.log(`Processing filePath ${filePath}`);
                                var filePathNameArray = filePath.split("/");
                                if (filePathNameArray.length == 0) {
                                    return;
                                }
                                var fileFullName = filePathNameArray[filePathNameArray.length - 1];
                                // console.log(`Processing filePath fileFullName ${fileFullName}`);
                                if (fileFullName == "") {
                                    return;
                                }
                                // filePath can be local server path or remote path
                                var fileURL = generateDataFileURL(filePath);
                                var curHtml = generateFileAndMediaDisplayHtml(fileFullName, fileURL, filePath);
                                if (curHtml != "") {
                                    mergeHtml += (curHtml);
                                }
                            })
                        }
                        // update html
                        container.innerHTML = mergeHtml;
                    }
                  } else {
                    // default to html
                    const htmlContainer = currentSegment.querySelector('.html-content');
                    if (htmlContainer) {
                        state.displayedContent += state.pendingContent;
                        state.pendingContent = "";
                        htmlContainer.innerHTML = state.displayedContent;
                    }
                  }
                  // add New Cursor Span
                  // cursorSpan = document.createElement('span');
                  // cursorSpan.className = 'typing-cursor';     
                  // if (cursorSpan) {
                  //   currentSegment.appendChild(cursorSpan);
                  // }
                  addCursor(currentSegment);

            }

    }

    /**
    * Container Elemenet
    */
    function startImageValidationAfterInsertion(containerElem) {
        if (!containerElement) return;
        try {
            const images = containerElement.getElementsByTagName('img');
            for (let img of images) {
                const src = img.src;
                if (src && if_valid_image_src(src)) {
                    verifyAndRemoveInvalidImage(img, src);
                }
            }
        } catch (err) {
            console.error(err)
        }
    }

    /**
    * display Content, 根据当前 State 来创建或者更新新的 div
    */
    function updateMessageDOM(state) {

        const messageId = state.messageId;
        const template = state.template;
        const messageRole = "assistant";

        var curMessageDiv = document.getElementById(messageId);
        if (curMessageDiv == null) {
            curMessageDiv = createDivByTemplate(template, state);
            curMessageDiv.id = messageId;

            const baseClassName = `message ${messageRole} ${messageTypeIncoming}`;
            curMessageDiv.className = curMessageDiv.className ? `${baseClassName} ${curMessageDiv.className}` : baseClassName;

            chatbox.appendChild(curMessageDiv);
            chatbox.scrollTop = chatbox.scrollHeight;

            // add multi tab event listener
            addMultiTabResultEventListener();

        }

        if (template == "streaming_content_type") {

            updateMessageDOMStreamingContentType(state, messageId);

        } else if (template == "reason_html") {

            updateMessageDOMHtmlTemplate(state, messageId);

        } else if (template == "multi_tab_message") {

            // update parent message id, Only First Batch is important
            // remaining batch will use StreamingContentType
            updateMessageDOMMultiTabTemplate(state, messageId);
        } else {
            updateMessageDOMHtmlTemplate(state, messageId);

        }


    }


    /**
    * Main function to process API request and update Message Card
    */
    async function callChatService(chatHistory, kwargs) {
        // Stream response from backend
        try {
            const response = await fetch(productionUrlPrefix + '/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory, kwargs: kwargs})
            });
            if (!response.body) throw new Error('No response body');
            const reader = response.body.getReader();
            // let assistantMsg = '';
            hideThinking();

            let responseMap = new Map()

            let decoder = new TextDecoder();

            var messageIdTotal = await processStream(reader, decoder);

            // add message rest API, wait for dom to update
            await new Promise(resolve => setTimeout(resolve, 5000));
            addAssistantMessageRestAPI(messageIdTotal);

            // remove cursor at the end of generation
            removeCursor(document);

        } catch (err) {
            appendSystemMessage('Error: ' + err.message);
        }
    }

    function getActiveHistoryItem() {

        var activeHistoryItem = document.getElementsByClassName('history-item-active');
        return activeHistoryItem;
    }

    /**
    * update the chat window
    **/
    async function updatePageNewMessage(chatHistory, kwargs) {
        // increament turn by 1
        // Create a new Chat
        var activeHistoryItem = getActiveHistoryItem();
        if (activeHistoryItem == null || activeHistoryItem.length == 0) {
            createNewChatHistoryDiv();
        }
        // update the last activeChat with turn=0 message as title
        var activeHistoryItemNew = getActiveHistoryItem();
        if (activeHistoryItemNew != null && activeHistoryItemNew.length >= 1) {

            var activeChat = activeHistoryItemNew[activeHistoryItemNew.length - 1];
            if (getActiveTurnId() == 0) {
                // update turnId=0, new session message to history item
                if (chatHistory.length >= 1) {
                    var lastIndex = chatHistory.length - 1;
                    var latestChat = chatHistory[lastIndex];
                    var content = latestChat.content;
                    var historyItemTitle = activeChat.querySelector(".history_title");
                    if (historyItemTitle != null) {
                        historyItemTitle.innerHTML = content;
                    }
                }
            }
        }

    }

    /**
    * Create New Chat Div
    */
    function createNewChatHistoryDiv() {
        // new Session Id

        var sessionId = generateUUID()


        // remove all the history item 
        var activeItemList = getActiveHistoryItem();
        for (var i = 0; i < activeItemList.length; i++) {
            var activeItem = activeItemList[i];
            activeItem.classList.remove("history-item-active");
        }

        // new Item and prepend to all
        const chatDiv = document.createElement('li');
        chatDiv.classList.add('history-item');
        chatDiv.classList.add('history-item-active');
        chatDiv.innerHTML = `<p class="history_title">Chat</p><a class="history_session_id" hidden="hidden">${sessionId}</a>`;

        // add click event to new dic
        chatDiv.addEventListener('click', 
                function() { addHistoryItemClickEvent(chatDiv); }
            );

        var chatHistoryElem = document.getElementById("chat-history");
        if (chatHistoryElem != null) {
            chatHistoryElem.prepend(chatDiv);
        }

        // set cur page session Id
        setPageSessionId(sessionId);

        // set cut page turn id
        setPageTurnId(-1);

        // clear current chat history
        chatHistory = [];

        return chatDiv;
    }

    // model selection
    const modelActionButton = document.querySelector('.action-btn');
    const modelDropDownContent = document.querySelector('.dropdown-content');
    
    document.addEventListener('click', (e) => {

        const isModelButtonClick = modelActionButton.contains(e.target);
        if (isModelButtonClick) {
            modelDropDownContent.classList.toggle('dropdown-content-show');
        } else {
            modelDropDownContent.classList.remove('dropdown-content-show');
        }
    });

    // AI Agent Marketplace End
    const dropdownItems = document.querySelectorAll('.dropdown-item');
    const workflowBtn = document.getElementById('workflowBtn');
    
    dropdownItems.forEach(item => {
        item.addEventListener('click', function() {
            const modelName = this.querySelector('strong').textContent;
            const dataValue = this.getAttribute('data-value');
            workflowBtn.querySelector('span').textContent = modelName;
            workflowBtn.setAttribute("data-value", dataValue);
        });
    });

    const thinkBtn = document.getElementById('thinkBtn');
    if (thinkBtn != null) {
        thinkBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            console.log('Think: ' + (this.classList.contains('active') ? 'Open' : 'Close'));
        });
    }

    const webSearchBtn = document.getElementById('webSearchBtn');
    if (webSearchBtn != null) {
        webSearchBtn.addEventListener('click', function() {
            this.classList.toggle('active');
            console.log('Web Search: ' + (this.classList.contains('active') ? 'Open' : 'Close'));
        });
    }

    // upload image and videos
    const imageUploadBtn = document.getElementById('imageUploadBtn');
    const imageFileBtn = document.getElementById('imageFile');

    function getFileExtensionFromFullPath(fileURL) {
        try {
            var fileItemsArray = fileURL.split("/");
            var fileFullName = "";
            if (fileItemsArray.length > 0) {
                fileFullName = fileItemsArray[fileItemsArray.length - 1];
            }
            
            // console.log(`fileFullName ${fileFullName}`);

            var fileFullNameArray = fileFullName.split(".");
            var fileExtension = "";
            if (fileFullNameArray.length > 0) {
                fileExtension = fileFullNameArray[fileFullNameArray.length - 1];
                fileExtension = "." + fileExtension;
            }
            // console.log(`fileExtension ${fileExtension}`);

            return fileExtension;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    function if_valid_image_src(src) {
        if (src && (src.startsWith('http://') || src.startsWith('https://'))) {
            return true;
        }
        return false;
    }

    /**
     */
    function verifyAndRemoveInvalidImage(imgElement, src) {
        const tempImg = new Image();

        tempImg.onload = function() {
            console.log(`Image Render Successfully: ${src}`);
        };

        tempImg.onerror = function() {
            // 图片加载失败，删除对应的img标签
            console.warn(`Image Render Failed，Element To Delete: ${src}`);
            if (imgElement && imgElement.parentNode) {
                imgElement.remove();
            }
        };

        // 设置超时处理
        const timeout = setTimeout(function() {
            console.warn(`图片加载超时，删除元素: ${src}`);
            if (imgElement && imgElement.parentNode) {
                imgElement.remove();
            }
            tempImg.onload = tempImg.onerror = null; // 清除事件处理器
        }, 10000); // 10秒超时

        tempImg.onload = function() {
            clearTimeout(timeout);
            console.log(`Loading Image Successfully: ${src}`);
        };

        tempImg.onerror = function() {
            clearTimeout(timeout);
            console.warn(`Loading Image Failed Removed: ${src}`);
            if (imgElement && imgElement.parentNode) {
                imgElement.remove();
            }
        };

        // Start Loading
        tempImg.src = src;
    }

    /**
    * Cannot directly determin content type by src, some URL don't have ending extension
    */
    function generateMediaDisplayHtmlWithAlt(src, content_type, alt) {
        var curHtml = "";
        if (src == null || alt == null) {
            return curHtml;
        }
        try {
            // image
            if (content_type == "image") {
                if (!if_valid_image_src(src)) {
                    console.warn(`Invalid Image Src URL: ${src}`);
                    return "";
                }
                // add verification
                var tempImageDivId = "img_" + generateUUID();
                curHtml = `<img id="${tempImageDivId}" class="message_media_display" src="${src}" alt="${alt}" onerror="this.style.display='none'">`;

            } else if (content_type == "video") {
                curHtml = `<div class="message_media_display_wrapper">
                                        <video class="message_media_display" controls loop muted preload="metadata">
                                            <source src="${src}" type="video/mp4">
                                            Your browser does not support the video.
                                        </video>
                                        <p><a target="_blank" href="${src}">Source</a></p>
                </div>
                `;
            } else if (content_type == "audio") {
                curHtml = `<div class="message_media_display_wrapper">
                                        <audio class="message_media_display" controls>
                                          <source src="${src}" type="audio/mp3">
                                          Your Browser Don't Support Audio
                                        </audio>
                                        <p><a target="_blank" href="${src}">Source</a></p>
                                    </div>
                `;
            } else {
                curHtml = "";
            }
            return curHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }


    /**
    * Cannot directly determin content type by src, some URL don't have ending extension
    */
    function generateMediaDisplayHtml(src, content_type) {
        var curHtml = "";
        if (src == null) {
            return curHtml;
        }
        try {
            // image
            if (content_type == "image") {
                curHtml = `<img class="message_media_display" src="${src}"></img>`;                
            } else if (content_type == "video") {
                curHtml = `<div class="message_media_display_wrapper">
                                        <video class="message_media_display" controls loop muted preload="metadata">
                                            <source src="${src}" type="video/mp4">
                                            Your browser does not support the video.
                                        </video>
                                        <p><a target="_blank" href="${src}">Source</a></p>
                </div>
                `;
            } else if (content_type == "audio") {
                curHtml = `<div class="message_media_display_wrapper">
                                        <audio class="message_media_display" controls>
                                          <source src="${src}" type="audio/mp3">
                                          Your Browser Don't Support Audio
                                        </audio>
                                        <p><a target="_blank" href="${src}">Source</a></p>
                                    </div>
                `;
            } else {
                curHtml = "";
            }
            return curHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    function generateIframeDisplayHtml(src) {
        var curHtml = "";
        if (src == null || content_type == null) {
            return curHtml;
        }
        try {
            curHtml = `
                    <div class="message_iframe_display_wrapper">
                                    <iframe onerror="loadIFrameFallback(this)" src="${src}" class="message_iframe_display">
                                        <p>The resources don't support preview, Please visit <a href="${src}">Link</a> directly. </p>
                                    </iframe>
                                    <p><a target="_blank" href="${src}">Source</a></p>
                    </div>
                `;
            return curHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    /**
    * Rendering resultss
    */
    function generateUploadMediaHtmlMutiple(resultArray) {
        if (resultArray == null) {
            return "";
        }
        try {
            var mergeHtml = "";
            for (const result of resultArray) {
                var url = result?.url;
                var fileName = result?.filename;
                var filePath = result?.filepath;
                var curHtml = generateFileAndMediaDisplayHtml(fileName, url, filePath);
                if (curHtml != "") {
                    mergeHtml += (curHtml);
                }
            }
            var uploadHtml = `<div class="segment-container"><div class="media-container-grid">${mergeHtml}</div></div>`;
            return uploadHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    if (imageUploadBtn != null) {

        // upload files
        const fileInput = document.getElementById('imageFile');
        const hintElement = document.getElementById('action-btn-hint');

        var uploadUserId = getActiveUserId();
        var uploadDialogueSessionId = getActiveSessionId();
        let successCount = 0;
        let failCount = 0;
        // const validFileExtensions = [".pdf", ".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"];
        if (fileInput) {

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (!files || files.length === 0) return;
                if (files.length > 4) {
                    showHint(`Upload maximum 4 files at the same time.`, imageUploadBtn);
                    e.target.value = '';
                    return;
                }
                var uploadResultArray = [];

                // Iterate Over Files
                for (const file of files) {
                    // 1. Check File Extension Supported
                    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    if (!validMediaExtensions.includes(extension)) {
                        showHint(`${extension} is not supported uploaded file type...`, imageUploadBtn);
                        e.target.value = '';
                        return;
                    }
                    // 2. File Size Restriction
                    const maxSize = 30 * 1024 * 1024; // 10MB
                    if (file.size > maxSize) {
                        showHint(`File Size Should Not Exceed ${maxSize/(1024 * 1024)} MB`, imageUploadBtn);
                        e.target.value = '';
                        return;
                    }

                    // 3. Upload Files
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const response = await fetch(`/files-wd/upload/media/${uploadUserId}/${uploadDialogueSessionId}`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) { 
                            // Fail
                            failCount += 1;
                        } else {

                            // upload results
                            successCount += 1;
                            const result = await response.json();
                            uploadResultArray.push(result);
                        }
                    } catch (err) {
                        console.error(err);
                        showHint(`Upload Failed. Please try again later.`, imageUploadBtn);
                    }
                }

                showHint(`Upload Successfully ${successCount} and Failed ${failCount}`, imageUploadBtn);

                // 
                // console.log("DEBUG: generateUploadMediaHtmlMutiple");
                // console.log(uploadResultArray);

                // Chat Div Create Message
                var uploadFileHtml = generateUploadMediaHtmlMutiple(uploadResultArray);
                // console.log(`DEBUG: generateUploadMediaHtmlMutiple ${uploadFileHtml}`);
                
                var newUploadMessageId = generateUUID();
                // upload file JS Variables
                addMessageToChatboxHtmlWrapper(newUploadMessageId, messageClsUserOutgoing, uploadFileHtml);
                // update ChatHistory JS Variables
                chatHistory.push({role: 'user', content: uploadFileHtml});                
            });

        }
    }

    function showHint(message, target) {
        try {
            const hintElement = document.getElementById('action-btn-hint');
            if (hintElement) {
                hintElement.textContent = message;
                hintElement.style.display = 'block';
                const rect = target.getBoundingClientRect();
                hintElement.style.top = `${rect.top - 40}px`;
                hintElement.style.left = `${rect.left}px`;
                setTimeout(() => hintElement.style.display = 'none', 3000);
            }
        } catch (err) {
            console.error(err);
        }
    }

    const fileUploadBtn = document.getElementById('fileUploadBtn');
    const documentFile = document.getElementById('documentFile');

    /**
    * Rendering resultss
    */
    function generateUploadFileHtmlMutiple(resultArray) {
        if (resultArray == null) {
            return "";
        }
        try {
            var mergeHtml = "";
            for (const result of resultArray) {
                // console.log(`Process Result`);
                // console.log({result});
                var url = result?.url;
                var absolutePath = result?.absolute_path;
                // filename full name with extension, e.g.: file_a.xlsx
                var fileName = result?.filename;
                var filePath = result?.filepath;
                // filesize 
                var size = result.size;
                // <div class="message_file_display_wrapper"></div>
                // merge multiple files
                var curHtml = generateFileAndMediaDisplayHtml(fileName, url, filePath);
                if (curHtml != "") {
                    mergeHtml += (curHtml);
                }
            }
            var uploadHtml = `<div class="segment-container"><div class="file-container-grid">${mergeHtml}</div></div>`;
            return uploadHtml;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    if (fileUploadBtn != null) {

        // upload files
        const fileInput = document.getElementById('documentFile');
        const hintElement = document.getElementById('action-btn-hint');

        var uploadUserId = getActiveUserId();
        var uploadDialogueSessionId = getActiveSessionId();
        let successCount = 0;
        let failCount = 0;
        // const validFileExtensions = [".pdf", ".xls", ".xlsx", ".doc", ".docx", ".ppt", ".pptx"];

        if (fileInput) {

            fileInput.addEventListener('change', async (e) => {
                const files = Array.from(e.target.files);
                if (!files || files.length === 0) return;
                if (files.length > 4) {
                    showHint(`Upload maximum 4 files at the same time.`, fileUploadBtn);
                    e.target.value = '';
                    return;
                }
                
                var uploadResultArray = [];

                // Iterate Over Files
                for (const file of files) {
                    // 1. Check File Extension Supported
                    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    if (!validFileExtensions.includes(extension)) {
                        showHint(`${extension} is not supported uploaded file type...`, fileUploadBtn);
                        e.target.value = '';
                        return;
                    }

                    // 2. File Size Restriction
                    const maxSize = 30 * 1024 * 1024; // 10MB
                    if (file.size > maxSize) {
                        showHint(`File Size Should Not Exceed ${maxSize/(1024 * 1024)} MB`, fileUploadBtn);
                        e.target.value = '';
                        return;
                    }

                    // 3. Upload Files
                    try {
                        const formData = new FormData();
                        formData.append('file', file);
                        
                        const response = await fetch(`/files-wd/upload/file/${uploadUserId}/${uploadDialogueSessionId}`, {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) { 
                            // Fail
                            failCount += 1;
                        } else {

                            // upload results
                            successCount += 1;
                            const result = await response.json();
                            uploadResultArray.push(result);
                        }
                    } catch (err) {
                        console.error(err);
                        showHint(`Upload Failed. Please try again later.`, fileUploadBtn);
                    }


                }

                showHint(`Upload Successfully ${successCount} and Failed ${failCount}`, fileUploadBtn);

                // Chat Div Create Message
                var uploadFileHtml = generateUploadFileHtmlMutiple(uploadResultArray);
                var newUploadMessageId = generateUUID();
                // update HTML       
                addMessageToChatboxHtmlWrapper(newUploadMessageId, messageClsUserOutgoing, uploadFileHtml);
                // update ChatHistory JS Variables
                chatHistory.push({role: 'user', content: uploadFileHtml});                
            });

        }
    }

    const templateBtn = document.getElementById('templateBtn');
    const templatePanel = document.getElementById('templatePanel');
    if (templatePanel != null) {
        const closeTemplatePanel = templatePanel.querySelector('.close-panel');
        if (closeTemplatePanel != null) {
            closeTemplatePanel.addEventListener('click', function() {
                templatePanel.style.display = 'none';
            });
        }
    }
    if (templateBtn != null) {
        templateBtn.addEventListener('click', function() {
            templatePanel.style.display = 'block';
        });
    }

    const memoryBtn = document.getElementById('memoryBtn');
    const memoryPanel = document.getElementById('memoryPanel');
    const closeMemoryPanel = memoryPanel.querySelector('.close-panel');
    
    if (memoryBtn != null) {
        memoryBtn.addEventListener('click', function() {
            memoryPanel.style.display = 'block';
        });
    }

    if (closeMemoryPanel) {
        closeMemoryPanel.addEventListener('click', function() {
            memoryPanel.style.display = 'none';
        });
    }

    if (sendBtn != null) {
        sendBtn.addEventListener('click', sendMessage);
    }

    if (searchInput != null) {
        searchInput.addEventListener('keydown', function(e) {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
    }


    function removeCursor(elem) {
        try {
            const cursorSpan = elem.querySelector(".typing-cursor");
            if (cursorSpan) {
                cursorSpan.remove();
            }
        } catch (err) {
            console.error(err);
        }
    }

    function addCursor(elem) {
        if (elem == null) {
            return;
        }
        try {
            const newCursorSpan = document.createElement('span');
            newCursorSpan.className = 'typing-cursor';            
            elem.appendChild(newCursorSpan);
        } catch (err) {

        }
    }

    function sendMessage() {
        const inputContent = searchInput.value.trim();
        if (inputContent) {
            // start new session_id
            setPageTurnId(getActiveTurnId() + 1);

            appendMessage(generateUUID(), 'user', 'outgoing', "", inputContent);
            chatHistory.push({role: 'user', content: inputContent});
            searchInput.value = '';
            appendSystemMessage('');

            showThinking();

            // Get Model Selection
            kwargs = {
                // "model_selection": getModelSelected(),
                "workflow_selection": getWorkflowSelected(),
                "session_id": getActiveSessionId(),
                "user_id": getActiveUserId(),
                "user_group": getActiveUserGroup(),
                "turn_id": getActiveTurnId(),
                "server_ids": getServerIdsFromURL(),
                "agent_ids": getAgentIdsFromURL()
            }
            // update chatbox
            callChatService(chatHistory, kwargs);

            // update chat history
            updatePageNewMessage(chatHistory, kwargs);

            // remove cursor
            removeCursor(document);
        }
    }

    function addMessageToChatbox(message, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message');
        messageDiv.classList.add(sender === 'user' ? 'outgoing' : 'incoming');

        // messageDiv.classList.add(sender === 'user' ? 'user-message' : 'bot-message');
        if (sender === 'bot' || sender === "assistant") {
            let formattedMessage = message.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
            formattedMessage = formattedMessage.replace(/\*(.*?)\*/g, '<em>$1</em>');
            formattedMessage = formattedMessage.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
            
            messageDiv.innerHTML = formattedMessage;
        } else {
            messageDiv.textContent = message;
        }
        
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    function addMessageToChatboxHtmlWrapper(msgId, msgCls, msgHtml) {
        const messageDiv = document.createElement('div');
        var msgClsList = msgCls.split(" ");
        if (msgClsList != null) {
            msgClsList.forEach(cls => {
                 messageDiv.classList.add(cls);
            });
        }
        messageDiv.setAttribute("id", msgId);
        messageDiv.innerHTML = msgHtml;
        chatbox.appendChild(messageDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
    }

    function showThinking() {
        const thinkingDiv = document.createElement('div');
        thinkingDiv.classList.add('div_thinking_status');
        thinkingDiv.innerHTML = '<p>Thinking</p><span class="dot-flashing"></span>';
        
        chatbox.appendChild(thinkingDiv);
        chatbox.scrollTop = chatbox.scrollHeight;
    }


    // remove div_thinking_status
    function hideThinking() {
        var removeThink = true;
        if (removeThink) {
            var div_thinking_section = document.querySelector('.div_thinking_status');
            if (div_thinking_section != null) {
                div_thinking_section.remove();
            }
        }
    }

    function generateResponse(message) {
        const responses = [
            "I think your question is about" + message + ". According to my latest knowledge, ",
            "About" + message + ", I can think of a few aspects...",
            "This question is very interesting " + message + "mechanism..."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    if (newChatBtn != null) {
        newChatBtn.addEventListener('click', function() {
            chatbox.innerHTML = '';
            searchInput.value = '';
            alert('New Chat Created');

            // append front end new chat
            createNewChatHistoryDiv();
        });

    }

    if (aiAgentMarketplaceSidebar != null) {
        aiAgentMarketplaceSidebar.addEventListener('click', function() {
            window.open("https://www.deepnlp.org/store/ai-agent");
        });
    }

    if (mcpMarketplaceSidebar != null ) {
        mcpMarketplaceSidebar.addEventListener('click', function() {
            // window.open(productionUrlPrefix + "/mcp", "_blank");
            window.open("https://www.deepnlp.org/store/ai-agent/mcp-server");
        });
    }

    function addHistoryItemClickEvent(item) {
        try {
                const chatTitle = item.textContent;

                var historyTitleElem = item.querySelector(".history_title");
                var historyTitle = "";
                if (historyTitleElem != null) {
                    historyTitle = historyTitleElem.innerText;
                }

                var historySessionIdElem = item.querySelector(".history_session_id");
                var historySessionId = "";
                if (historySessionIdElem != null) {
                    historySessionId = historySessionIdElem.innerText;
                }
                // chatbox.innerHTML = `<div class="message bot-message">Loading Chat History: ${chatTitle}...</div>`;
                setTimeout(() => {

                    chatbox.innerHTML = '';

                    // fetch from DB session message

                    fetch(productionUrlPrefix + `/message/${historySessionId}`, {
                        method: 'GET',
                        headers: { 'Content-Type': 'application/json' }
                    })
                    .then(response => response.json())
                    .then(data => {
                        // console.log('Response Return Message Successfully:', data);
                        var messages = data.messages;
                        var success = data.success;
                        if (success) {
                            if (messages != null) {
                                //display messages
                                messages.forEach(p => {
                                    var msgClsList = (p.role == "user")?messageClsUserOutgoing: messageClsAssistantIncoming;
                                    addMessageToChatboxHtmlWrapper(p.msg_id, msgClsList, p.content);
                                })
                            }
                        } else {
                            var errorMessage = "No History Message Found...";
                            addMessageToChatbox(errorMessage, 'bot');
                        }
                    })
                    .catch(error => {
                        console.error('Response Return Message Failed:', error);
                    });
                }, 1000);

        } catch (err) {
            console.error(err);
        }

    }

    if (historyItemSideBar != null) {
        historyItemSideBar.forEach(item => {
            item.addEventListener('click', function() {
                addHistoryItemClickEvent(item);
            });
        });
    }

    if (settingBtn != null) {
        document.querySelector('.setting-btn').addEventListener('click', function() {
            chatbox.innerHTML = '';
        });
    }

    // Non-Dom Loaded Function Starts
    // Dpn't need to tie to an element
    function clickButtonAction(action_name) {

            var message = '<action>' + action_name + '</action>'

            appendMessage(generateUUID(), 'user', 'outgoing', "", action_name);
            chatHistory.push({role: 'user', content: message});
            
            searchInput.value = '';
            appendSystemMessage('');

            // Call Backend Chat Service
            // Get Model Selection
            modelSelection = getModelSelected()
            kwargs = {"model_selection": modelSelection}
            callChatService(chatHistory, kwargs);
    }

    chatContainerDiv.addEventListener('click', (e) => {

        if (e.target.closest('.tool-call-header, .arrow, .header-text')) {
            handleToolCallHeaderClick(e);
        }

        // add return button click
        if (e.target.matches(".agent-button-base")) {
            handleToolCallResultUserSelect(e.target);
        }

        // 
        if (e.target.matches(".delete-tool")) {
            handleToolboxItemDelete(e.target)
        }

    });

    /**
    * Stop Event Pop Up Too Many Times,
    * Args:
        evevnt
    */
    function handleToolCallHeaderClick(event) {

        event.stopPropagation();
        const container = event.target.closest('.tool-call-container');
        // var container = target.closest('.tool-call-container');
        if (container) {
            // Call back to get the result again
            var curContentArea = container.querySelector('.collapsible-content');
            var curHeader = container.querySelector('.tool-call-header');
            var curArrow = container.querySelector('.arrow');

            if (curContentArea != null) {
                const isExpanded = curContentArea.classList.toggle('tool_call_expanded');
                curArrow.textContent = isExpanded ? '▼' : '▶';
                
                if (isExpanded && curContentArea.children.length === 0) {

                    // update new Json
                    addParametersSection(jsonData);
                    addButtonOptionsSection();
                    // simulateAsyncResult();
                }
                // console.log('Button container clicked:', container);
            }
        }
    }

    /**
    * Add Click Event to Rendered Element in Html
    */
    function addEventListenerDynamicButton(buttonElement, actionName) {
        if (buttonElement == null) {
            return;
        }
        buttonElement.addEventListener('click', () => {
                clickButtonAction(actionName); 
            }
        );
        buttonElement.setAttribute("set_on_click", true);
        // console.log(buttonElement)
    }

    /**
    * <input type="button" class="agent-button-base agent-button-highlight" value="ACCEPT">
    */
    function handleToolCallResultUserSelect(button) {        
        // addEventListenerDynamicButton(buttonElem, actionName);
        clickButtonAction(button.value);
    }


    function handleToolboxItemDelete(toolDeleteSpan) {
        
        var toolItem = toolDeleteSpan.parentElement;
        if (toolItem != null) {
            toolItem.remove();
        }
    }

    // display server click
    document.querySelectorAll('.toggle-container').forEach(toggle => {
            toggle.addEventListener('click', () => {
                const toolGrid = toggle.nextElementSibling;
                const serverItem = toggle.closest('.mcp-server-item');
                
                if (toolGrid.classList.contains('expanded')) {
                    toolGrid.classList.remove('expanded');
                    serverItem.classList.remove('expanded');
                } else {
                    toolGrid.classList.add('expanded');
                    serverItem.classList.add('expanded');
                }

                // set dynamic position calculate left width 
                if (toolGrid.classList.contains('expanded')) {
                    // set expanded left position
                    const leftPos = serverItem.getBoundingClientRect().left;
                    toolGrid.style.setProperty('--menu-left', `${leftPos}px`);
                }
            });
    });

    async function apiCall(url, method = 'GET', body = null) {
        try {
            const options = {
                method,
                headers: { 'Content-Type': 'application/json' },
            };
            if (body) {
                options.body = JSON.stringify(body);
            }
            const response = await fetch(url, options);
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: response.statusText }));
                throw new Error(`HTTP error ${response.status}: ${errorData.detail || 'Unknown error'}`);
            }
            return await response.json();
        } catch (error) {
            console.error(`API call to ${url} failed:`, error);
            // alert(`Error: ${error.message}`); // Simple error display
            // throw error;
        }
    }

    // move left or right
    document.querySelector('.scroll-btn.right').addEventListener('click', () => {
        document.querySelector('.mcp-servers-list').scrollBy({ left: 200, behavior: 'smooth' });
    });
    document.querySelector('.scroll-btn.left').addEventListener('click', () => {
        document.querySelector('.mcp-servers-list').scrollBy({ left: -200, behavior: 'smooth' });
    });
    
    function toggleMCPModal() {
        const modal = document.getElementById('serverModal');
        modal.classList.toggle('active');
    }

    document.querySelector('.add-server-button').addEventListener('click', function() {
        toggleMCPModal()
    });

    document.querySelector('.modal-button.primary').addEventListener('click', async function() {
        //Add Chosen Server to Panel
        toggleMCPModal();
    });

    document.querySelector('.modal-button.secondary').addEventListener('click', function() {
        toggleMCPModal();
    });

    const bannerActionList = document.querySelectorAll('.banner-action-small-btn');
    if (bannerActionList) {
        bannerActionList.forEach(banner => {
            banner.addEventListener('click', function() {
                // navigate to new page
                choose_agent_from_banner(banner);
            });
        })
    }

    /**
     * banner_type: agent/mcp
     * */
    function choose_agent_from_banner(bannerElem) {
        if (bannerElem == null) {
            return;
        }
        try {
            const serverInfo = bannerElem.closest(".server-info");
            if (serverInfo) {
                const idElem = serverInfo.querySelector(".server-id");
                var idText = idElem.textContent;
                const typeElem = serverInfo.querySelector(".server-type");
                var typeText = typeElem.textContent;
                const currentUrl = new URL(window.location.href);
                const baseUrl = currentUrl.origin + currentUrl.pathname;
                const newUrl = new URL(baseUrl);
                if (typeText == "mcp") {
                    // 使用 searchParams.set 方法设置参数
                    newUrl.searchParams.set("server", idText);
                } else if (typeText == "agent") {
                    // 使用 searchParams.set 方法设置参数
                    newUrl.searchParams.set("agent", idText);
                } else {
                }
                window.location.href = newUrl.toString();
            }

        } catch (err) {
            console.error(err);
        }
    }

    /** Support Various Panel */
    const closeModalButtonList = document.querySelectorAll('.close-panel');
    for (var i = 0; i < closeModalButtonList.length; i++) {
        const closeModalButton = closeModalButtonList[i];
        closeModalButton.addEventListener('click', (e) => {

            if (e.target.closest("#userLoginModal")) {
                toggleUserLoginModal();
            } else if (e.target.closest("#serverModal")) {
                toggleMCPModal();
            } else if (e.target.closest("#mediaModal")) {
                toggleMediaModal();
            } else {
                //default
                toggleMCPModal();
            }
        });
    }

    // document.querySelector('.close-panel').addEventListener('click', (e) => function() {

    //     if (e.target.closest("#userLoginModal")) {
    //         toggleUserLoginModal();
    //     } else if (e.target.closest("#serverModal")) {
    //         toggleMCPModal();
    //     } else {
    //         //default
    //         toggleMCPModal();
    //     }
    // });

    async function syncUserBillingData() {
        var accessKey = localStorage.getItem(scene + "_access_key");
        var userId = localStorage.getItem(scene + "_user_id");
        if (accessKey == null) {
            return;
        }
        try {
            // sync
            const requestData = {
                user_id: userId,
                access_key: accessKey,
                scene: scene
            };
            var requestDataJson = JSON.stringify(requestData);
            var endpoint = "https://www.deepnlp.org/login_third_party";
            // var endpoint = 'http://localhost:8080/login_third_party';

            // display
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: requestDataJson
            });

            if (!response.ok) {
                // throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                console.log(`HTTP ${response.status}: ${response.statusText}`);
                return;
            }
            const data = await response.json();
            var if_authenticate = data?.if_authenticate;
            if (if_authenticate) {
                var dataUserId = data?.user_id;
                var dataUserGroup = data?.user_group;
                var dataImageIdAvatar = data?.image_id_avatar;
                var accessKey = data?.access_key;
                var dataScene = data?.scene;

                var dataBillingPlan = data?.billing_plan ?? "-";
                var dataBillingBalanceRaw = data?.billing_balance ?? 0;
                var dataBillingBalance = parseInt(dataBillingBalanceRaw, 10);

                // update DOM
                if (userCenter != null) {
                    // 3.0 hide login form and display logged out form
                    if (document.querySelector(".login-body") != null) {
                        document.querySelector(".login-body").style.display = "none";
                    }
                    const logoutElem = document.querySelector(".logout-body");
                    if (logoutElem != null) {
                        logoutElem.style.display = "block";
                    }
                    if (logoutElem != null) {
                        const billingPlan = logoutElem.querySelector(".user-billing-plan");
                        if (billingPlan != null) {
                            billingPlan.innerHTML = `Plan ${dataBillingPlan}`;
                        }
                        // Current Balance
                        const billingBalance = logoutElem.querySelector(".user-billing-balance");
                        if (billingBalance != null) {
                            billingBalance.innerHTML = `<img class="display_card_image_thumbnail_img_xs_small" src="https://static.aiagenta2z.com/scripts/img/credit_icon.jpg"><span>${dataBillingBalance}</span>`;
                        }
                    }
                }
            } else {
                console.error(`Access Key Unauthentificated ${accessKey}`)
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
    * before toggle, should sync the pricing data
    */
    function toggleUserLoginModal() {
        const modal = document.getElementById('userLoginModal');
        // each time toggle the user model, we should update the status
        if (!modal.classList.contains('active')) {
            // before toggle (show), Sync the Billing Data Before
            syncUserBillingData()
        }
        modal.classList.toggle('active');
    }

    if (document.querySelector('.user-info') != null) {
        document.querySelector('.user-info').addEventListener('click', function() {
            toggleUserLoginModal();
        });
    }


    /**
    * args: userCenterElem element
    */
    function displayLoggedInUserInfo(userCenterElem, userId, imageIdAvatar) {
        if (userCenterElem == null || userId == null || userId == "") {
            return;
        }
        try {
            const userAvatar = userCenterElem.querySelector(".user-avatar");
            const userNameDiv = userCenterElem.querySelector(".username");
            if (userAvatar != null) {
                if (imageIdAvatar != null && imageIdAvatar != "") {
                    userAvatar.innerHTML = `<img class="display_card_image_thumbnail_img_small" src="${imageIdAvatar}">`;
                    userAvatar.style.backgroundColor = '';
                } else {
                    userAvatar.innerHTML = `U`;
                }
            }
            if (userNameDiv != null) {
                if (userId == "" || userId.startsWith("USER_")) {
                    // show login button
                    if (userInfoLoginBtn) {
                        userInfoLoginBtn.style.display = "block";
                    }
                    // clear
                    userNameDiv.innerText = "";
                } else {
                    userNameDiv.innerText = userId;
                    // hide button
                    if (userInfoLoginBtn) {
                        userInfoLoginBtn.style.display = "none";
                    }
                }
            }
        } catch (err) {
            console.log(err);
        }
    }


    /**
    * Login User to Website
    */
    async function postLoginUser() {

        const loginResultMessage = document.getElementById('login_result_message');

        try {

            const userIdElem = document.getElementById('username');
            const userId = (userIdElem != null)?userIdElem.value:"";

            const passwordElem = document.getElementById('password');
            const password = (passwordElem != null)?passwordElem.value:"";
            // const scene = "agent_mcp_tool_use";

            // 构建请求体
            const requestData = {
                user_id: userId,
                password: password,
                scene: scene
            };
            var requestDataJson = JSON.stringify(requestData);
            var endpoint = "https://www.deepnlp.org/login_third_party";
            // var endpoint = 'http://localhost:8080/login_third_party';

            // display
            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: requestDataJson
            });

            if (!response.ok) {
                // throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                console.log(`HTTP ${response.status}: ${response.statusText}`);
                return;
            }

            const data = await response.json();

            var if_authenticate = data?.if_authenticate;
            if (if_authenticate) {
                if (loginResultMessage != null) {
                    loginResultMessage.innerText = "Login Successfully...";
                    loginResultMessage.classList.add("login-success"); 
                    alert("Login Successfully...");
                }
                var dataUserId = data?.user_id;
                var dataUserGroup = data?.user_group;
                var dataImageIdAvatar = data?.image_id_avatar;
                var accessKey = data?.access_key;
                var dataScene = data?.scene;
                var dataBillingPlan = data?.billing_plan ?? "-";
                var dataBillingBalanceRaw = data?.billing_balance ?? 0;
                var dataBillingBalance = parseInt(dataBillingBalanceRaw, 10);

                // update DOM
                if (userCenter != null) {

                    // 1.0 display user info in the user center
                    displayLoggedInUserInfo(userCenter, dataUserId, dataImageIdAvatar);
                    // 1.1 hide button
                    if (userInfoLoginBtn) {
                        userInfoLoginBtn.style.display = "none";
                    }
                    // 2.0 Update User ID and User Group in the Dialogue Session
                    const dialogueUserId = document.getElementById("dialogue_user_id");
                    if (dialogueUserId) {
                        // set the user id to send back to chat/agent system
                        dialogueUserId.innerText = dataUserId;
                    }
                    const dialogueUserGroup = document.getElementById("dialogue_user_group");
                    if (dialogueUserGroup) {
                        dialogueUserGroup.innerText = dataUserGroup;
                    }
                    // 3.0 hide login form and display logged out form
                    if (document.querySelector(".login-body") != null) {
                        document.querySelector(".login-body").style.display = "none";
                    }
                    const logoutElem = document.querySelector(".logout-body");
                    if (logoutElem != null) {
                        logoutElem.style.display = "block";
                    }
                    if (logoutElem != null) {
                        logoutElem.style.display = "block";
                        const displayUserId = logoutElem.querySelector(".logged-in-user-id");
                        if (displayUserId != null) {
                            displayUserId.innerText = dataUserId;
                        }
                        const userAvatarLogout = logoutElem.querySelector(".user-avatar-form-center");
                        if (userAvatarLogout != null) {
                            if (dataImageIdAvatar == null) {
                                userAvatarLogout.innerHTML = dataUserId[0];
                            } else {
                                userAvatarLogout.innerHTML = `<img class="display_card_image_thumbnail_img_small" src="${dataImageIdAvatar}">`;
                            }
                        }
                        // billing
                        // Current Plan
                        const billingPlan = logoutElem.querySelector(".user-billing-plan");
                        if (billingPlan != null) {
                            billingPlan.innerHTML = `Plan ${dataBillingPlan}`;
                        }
                        // Current Balance
                        const billingBalance = logoutElem.querySelector(".user-billing-balance");
                        if (billingBalance != null) {
                            billingBalance.innerHTML = `<img class="display_card_image_thumbnail_img_xs_small" src="https://static.aiagenta2z.com/scripts/img/credit_icon.jpg"><span>${dataBillingBalance}</span>`;
                        }
                    }
                    // 2.0 Second Login to App and Session
                    var loginAppEndPoint = "/login_app";
                    var loginAppData = {
                        user_id: dataUserId,
                        user_group: dataUserGroup,
                        access_key: accessKey,
                        scene: dataScene
                    };
                    var loginAppDataJson = JSON.stringify(loginAppData);
                    const appLoginResponse = await fetch(loginAppEndPoint, {
                        method: 'POST',
                        headers: { 
                            'Content-Type': 'application/json'
                        },
                        body: loginAppDataJson
                    });
                    if (!appLoginResponse.ok) {
                        console.log(`HTTP ${appLoginResponse.status}: ${appLoginResponse.statusText}`);
                    }

                    // 3.0 Save Login Information to Local Storage
                    // sessionStorage.setItem(scene + "_user_id", dataUserId);
                    // sessionStorage.setItem(scene + "_image_id_avatar", dataImageIdAvatar);
                    // sessionStorage.setItem(scene + "_user_group", dataUserGroup);
                    // sessionStorage.setItem(scene + "_access_key", accessKey);
                    localStorage.setItem(scene + "_user_id", dataUserId);
                    localStorage.setItem(scene + "_image_id_avatar", dataImageIdAvatar);
                    localStorage.setItem(scene + "_user_group", dataUserGroup);
                    localStorage.setItem(scene + "_access_key", accessKey);
                }
                // close login modal
                toggleUserLoginModal();
            } else {
                if (loginResultMessage != null) {
                    loginResultMessage.classList.add("login-fail");
                    loginResultMessage.innerText = "Login Password Incorrect...";
                }
            }

        } catch (e) {
            console.log(e);
            if (loginResultMessage != null) {
                loginResultMessage.classList.add("login-fail");                
                loginResultMessage.innerText = "Login Failed. Please Try Again Later...";
            }
        }

    }


    function generateRandomCode(num) {
        const charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let code = '';
        for (let i = 0; i < num; i++) {
            const randomIndex = Math.floor(Math.random() * charset.length);
            code += charset[randomIndex];
        }
        return code;
    }

    async function postLogOutUser() {
        try {
            // logout/logout diplay change
            if (document.querySelector(".login-body") != null) {
                document.querySelector(".login-body").style.display = "block";
            }
            const logoutElem = document.querySelector(".logout-body");
            if (logoutElem != null) {
                logoutElem.style.display = "none";
            }
            // close panel
            toggleUserLoginModal();
            // status
            const loginStatus = document.querySelector(".login-status");
            if (loginStatus) {
                loginStatus.innerText = "";
            }
            // clean userCenter
            var newTempUseId = "USER_" + generateRandomCode(4);
            const userCenter = document.querySelector(".user-center");
            if (userCenter != null) {
                displayLoggedInUserInfo(userCenter, newTempUseId, "");
            }
            const dialogueUserId = document.getElementById("dialogue_user_id");
            if (dialogueUserId) {
                // set the user id to send back to chat/agent system
                dialogueUserId.innerText = newTempUseId;
            }
            const dialogueUserGroup = document.getElementById("dialogue_user_group");
            if (dialogueUserGroup) {
                dialogueUserGroup.innerText = "free";
            }
            clean_login_from_local_storage();
            // // clean session variables
            // // Save Login Information to Session Storage
            // localStorage.setItem(scene + "_user_id", "");
            // localStorage.setItem(scene + "_image_id_avatar", "");
            // localStorage.setItem(scene + "_user_group", "");
            // // 下次登录带上 access_key, 监控 usage
            // localStorage.setItem(scene + "_access_key", "");

        } catch (err) {
            console.log(err);
        }
    }

    // change login class from form to div, form has special click event
    const loginButton = document.querySelector(".login-btn");
    if (loginButton != null) {
        loginButton.addEventListener('click', function() {
            postLoginUser();
        });
    }

    const logoutButton = document.querySelector(".logout-btn");
    if (logoutButton != null) {
        logoutButton.addEventListener('click', function() {
            postLogOutUser();
        });
    }

    function copyToClipboard(text) {
        try {
            // 首先尝试现代API
            navigator.clipboard.writeText(text);
            alert("Copy Successfully!");
        } catch (err) {            
            try {
                // 然后尝试备选方法
                const textarea = document.createElement('textarea');
                textarea.value = text;
                document.body.appendChild(textarea);
                textarea.select();
                
                const successful = document.execCommand('copy');
                document.body.removeChild(textarea);
                
                if (successful) {
                    alert("Copy Successfully!");
                } else {
                    throw new Error('Failed');
                }
            } catch (err) {
                console.error('Failed:', err);
                alert("Copy Failed!");
            }
        }
    }

    chatContainerDiv.addEventListener('click', (e) => {

        // multiple copy button exist in the chat Container?
        const copyButton = e.target.closest('.copy-button');
        if (!copyButton) return;
        const codeContainer = copyButton.closest('.code-container');
        if (!codeContainer) return;
        const codeBlockElement = codeContainer.querySelector('.code-block');
        if (!codeBlockElement) return;

        const codeContent = codeBlockElement.textContent;
        copyToClipboard(codeContent);

    });

    // click on the main content
    // click on the main content
    mainContentDiv.addEventListener('click', (e) => {
        // mcp-server-item expanded: tool-item
        const expandedList = mainContentDiv.querySelectorAll(".expanded");
        if (expandedList != null && !e.target.closest(".mcp-server-item")) {
            expandedList.forEach(toolGrid => {
                if (toolGrid.classList.contains('expanded')) {
                    toolGrid.classList.remove('expanded');
                }
                serverItem = toolGrid.closest(".mcp-server-item");
                if (serverItem != null && serverItem.classList.contains('expanded')) {
                    serverItem.classList.remove('expanded');
                }
            });
        }
    });


    // scroll the banner hide the tools
    serverScrollDiv.addEventListener('scroll', (e) => {
        // mcp-server-item expanded: tool-item
        const expandedList = mainContentDiv.querySelectorAll(".expanded");
        if (expandedList != null) {
            expandedList.forEach(toolGrid => {
                if (toolGrid.classList.contains('expanded')) {
                    toolGrid.classList.remove('expanded');
                }
                serverItem = toolGrid.closest(".mcp-server-item");
                if (serverItem != null && serverItem.classList.contains('expanded')) {
                    serverItem.classList.remove('expanded');
                }
            });
        }
    });

    /**
    * collect users' action
    */
    async function userActionToolbar(action) {

        alert("Thanks for your feedback");

        kwargs = {
            "model_selection": getModelSelected(),
            "session_id": getActiveSessionId(),
            "user_id": getActiveUserId(),
            "user_group": getActiveUserGroup(),            
            "turn_id": getActiveTurnId(),
            "server_ids": getServerIdsFromURL(),
            "action": action
        }

        const response = await fetch(productionUrlPrefix + '/api/action', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ messages: chatHistory, kwargs: kwargs})
        });
        if (!response.body) throw new Error('No response body');
    }


    async function openFilePreview(fileIconWrapper) {
        if (fileIconWrapper == null) {
            return;
        }
        try {
            // Change Layout
            const mainContentDiv = document.querySelector(".main-content");
            const previewSectionDiv = document.querySelector(".preview-section");
            const mcpServerListDiv = document.querySelector(".mcp-servers-list-container");

            if (mainContentDiv == null || previewSectionDiv == null || mcpServerListDiv == null) {
                console.log("openFilePreview find mainContentDiv or previewSectionDiv or mcpServerListDiv missing...")
                return;
            }

            mainContentDiv.classList.toggle('collapsed');
            previewSectionDiv.classList.toggle('active');
            mcpServerListDiv.classList.toggle('close');
            
            var isPreviewOpen = true;

            if (isPreviewOpen) {
                // render preview
                const fileType = fileIconWrapper.dataset.fileType;
                const fileUrl = fileIconWrapper.dataset.fileUrl;
                const fileName = fileIconWrapper.dataset.fileName;
                                
                // currentFileUrl = fileUrl;
                previewTitle.textContent = fileName;
                // 显示加载指示器
                // showLoading();
                
                // 加载文件
                await loadFileInPreview(fileName, fileType, fileUrl);
                
                // 开始定期检查更新
                // startUpdateCheck();
            }

        } catch (err) {
            console.error(err);
        }

    }

    function loadScript(url, localFilePath, timeout = 5000) {
        return new Promise((resolve, reject) => {
            const cdnScript = document.createElement('script');
            cdnScript.src = url;
            const timeoutId = setTimeout(() => {
                console.warn(`CDN loading timed out after ${timeout}ms, falling back to local.`);
                loadLocalScript();
            }, timeout);

            const loadLocalScript = () => {
                clearTimeout(timeoutId);
                if (document.head.contains(cdnScript)) {
                    document.head.removeChild(cdnScript);
                }

                const localScript = document.createElement('script');
                localScript.src = localFilePath;
                localScript.onload = () => resolve(window.XLSX);
                localScript.onerror = () => reject(new Error('Failed to load both CDN and local script.'));
                document.head.appendChild(localScript);
            };

            cdnScript.onload = () => {
                clearTimeout(timeoutId);
                console.log('XLSX library loaded from CDN.');
                resolve(window.XLSX);
            };

            cdnScript.onerror = () => {
                clearTimeout(timeoutId);
                console.error('Failed to load from CDN, falling back to local.');
                loadLocalScript();
            };

            document.head.appendChild(cdnScript);
        });
    }

    /**
    * Required Sections:
    * # editorSection
    * # currentFileName
    * # hotable
    */
    let isXlsxLoaded = false;
    let workbook = null;
    let worksheet = null;

    function downloadPreviewFile(fileUrl, fileName) {
        if (fileUrl == "" || fileUrl == null || fileName =="" || fileName == null) {
            return;
        }
        try {
            // Open New Windown
            window.open(fileUrl, '_blank');
            showPreviewNotification('File Download Successfully..');
        } catch (error) {
            console.error('Download Error:', error);
            showPreviewNotification('Download Failed: ' + error.message, true);
        }
    }


    async function savePreviewFile() {

        try {
            // Write JS Temp Files to Local
            const wbout = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
            const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
            
            const formData = new FormData();
            formData.append('file', blob, currentFileName);
            
            // await axios.post(`http://localhost:8000/save/${currentFileId}`, formData, {
            //     headers: {
            //         'Content-Type': 'multipart/form-data'
            //     }
            // });
        
            const response = await fetch(`http://localhost:8000/save/${currentFileId}`, {
                method: 'POST',
                body: formData // FormData 对象，fetch 会自动设置合适的 Content-Type 及边界
              });
            showPreviewNotification('File Save Successfully!');
        } catch (error) {
            console.error('Save error:', error);
            showPreviewNotification('Save Failed: ' + error.message, true);
        }

    }


    function showPreviewLoading() {
        const loadingDiv = document.createElement('div');
        loadingDiv.classList.add('div_loading_status');
        loadingDiv.innerHTML = '<p>Loading</p><span class="dot-flashing"></span>';
        
        const previewControlElem = document.querySelector(".preview-controls");
        // no duplicate loading
        if (previewControlElem) {
            var loadingStatusExistElem = previewControlElem.querySelector(".div_loading_status");
            if (loadingStatusExistElem == null) {
                previewControlElem.prepend(loadingDiv);
            }
        }
    }

    function removePreviewLoading() {        
        const previewControlElem = document.querySelector(".preview-controls");
        if (previewControlElem) {
            const loadingElem = previewControlElem.querySelector(".div_loading_status");
            if (loadingElem) {
                loadingElem.remove();
            }
        }
    }

    /**
    * Get File From Download URL, Render File in the preview Sections
    * fileType: pdf, xls, xlsx, doc, docx, folder, 这个对于 Image/video不适用
    * fileUrl: localhosturl, or preview url
    * fileUrl: e.g. /files-wd/download/{user_name}/{session_id}/{file_path:path}
     *
     * e.g.
     * // file-type: folder, file-url: "/files-wd/download/user_4928/7ee23cbc-6a40-4e1c-8812-477ed8d54320", "7ee23cbc-6a40-4e1c-8812-477ed8d54320"
    */
    async function loadFileInPreview(fileName, fileType, fileUrl) {
        try {

            // enable loading
            showPreviewLoading();

            if (fileType == "xls" || fileType == "xlsx") {
                    
                const previewContentElem = document.querySelector(".preview-content");
                var previewDocumentSectionId = "preview-doc-content";
                var tableHtml = `<div class="toolbar">
                                            <button class="download-btn" id="preview_download_button">Download</button>
                                        </div>
                                        <div class="table-container">
                                            <div id="${previewDocumentSectionId}" data-file-url="${fileUrl}" data-file-type="${fileType}" data-file-name="${fileName}"></div>
                                        </div>`;

                if(!isXlsxLoaded) {
                    // 动态加载XLSX库
                    // console.log("Start Loading Scripts...")
                    var url = 'https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js';
                    var localXlsFilePath = productionUrlPrefix + "/static/scripts/xlsx.full.min.js";
                    await loadScript(url, localXlsFilePath, timeout=2000);
                    // console.log("End Loading Scripts...")

                    // 标记库已加载，防止下次点击再加载
                    isXlsxLoaded = true;

                    const response = await fetch(`${fileUrl}`);
                    if (!response.ok) {
                        throw new Error(`Network Error: ${response.status} ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();
                
                    workbook = XLSX.read(arrayBuffer, { type: 'array' });

                    // console.log("loadFileInPreview Loading workbook Data")
                    // console.log(workbook)

                    divTableElem = document.createElement("div");
                    divTableElem.className = "table-display-section";
                    divTableElem.id = "tableDisplaySection";
                    divTableElem.innerHTML = tableHtml;
                    if (previewContentElem) {
                        previewContentElem.innerHTML = "";
                        previewContentElem.appendChild(divTableElem);
                    }

                    displayExcel(workbook, previewDocumentSectionId);

                } else {

                    const response = await fetch(`${fileUrl}`);
                    if (!response.ok) {
                        throw new Error(`Network Error: ${response.status} ${response.statusText}`);
                    }
                    const arrayBuffer = await response.arrayBuffer();

                    // Read XLX
                    workbook = XLSX.read(arrayBuffer, { type: 'array' });
                    
                    console.log("loadFileInPreview Loading workbook Data")
                    console.log(workbook)

                    divTableElem = document.createElement("div");
                    divTableElem.className = "table-display-section";
                    divTableElem.id = "tableDisplaySection";
                    divTableElem.innerHTML = tableHtml;
                    if (previewContentElem) {
                        previewContentElem.innerHTML = "";
                        previewContentElem.appendChild(divTableElem);
                    }

                    displayExcel(workbook, previewDocumentSectionId);
                }

            } else if (fileType == "doc" || fileType == "docx") {
                // file preview
                var fileFullURL = generate_file_url(fileUrl);
                var previewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileFullURL)}`;
                displayOnlineOfficePreview(previewUrl);

            } else if (fileType == "ppt" || fileType == "pptx" || fileType == "doc" || fileType == "docx") {
                var fileFullURL = generate_file_url(fileUrl);
                var previewUrl = `https://view.officeapps.live.com/op/view.aspx?src=${encodeURIComponent(fileFullURL)}`;
                displayOnlineOfficePreview(previewUrl);
            } else if (fileType == "md" || fileType == "txt" || fileType == "json") {
                displayPlainTextPreview(fileUrl);
            }else if (fileType == "pdf") {
                displayIframePreview(fileUrl);
            } else if (fileType == "folder") {
                displayFolderPreview(fileUrl);
            } else {
                displayIframePreview(fileUrl);
            }

            removePreviewLoading();

        } catch (err) {
            console.error(err);
        }
    }

    /**
     * click on the preview button
     *
     * */
    previewContentElem.addEventListener('click', (e) => {
        try {
            if (e.target.closest('#preview_download_button')) {

                const previewDoc = document.querySelector("#preview-doc-content");
                var previewDocURL = "";
                var previewName = "";
                if (previewDoc) {
                    previewDocURL = previewDoc.dataset.fileUrl;
                    previewName = previewDoc.dataset.fileName;
                }
                downloadPreviewFile(previewDocURL, previewName);
            } else if (e.target.closest('.download-btn')) {
                const downloadBtn = e.target.closest('.download-btn');
                var downloadUrl = downloadBtn.getAttribute('data-url');
                const fileNameElem = downloadBtn.closest(".preview-file-item").querySelector(".preview-file-name a");
                var fileNameText = (fileNameElem!=null)?fileNameElem.text:"";
                downloadPreviewFile(downloadUrl, fileNameText);
            }
        } catch (err) {
            console.error(err);
        }
    });

    /**
    * Preview Section Notification
    */
    function showPreviewNotification(message, isError = false) {
        try {
            const notification = document.getElementById('preview_notification');
            notification.textContent = message;
            notification.className = isError ? 'notification error' : 'notification';
            notification.style.display = 'block';
            
            setTimeout(() => {
                notification.style.display = 'none';
            }, 3000);

        } catch (err) {
             console.error(err);
        }
    }

    function displayExcel(workbook, displayTableId) {
        try {

            const firstSheetName = workbook.SheetNames[0];
            worksheet = workbook.Sheets[firstSheetName];
            
            const html = XLSX.utils.sheet_to_html(worksheet, {
                editable: true,
                header: ''
            });
            
            var tableElem = document.getElementById(displayTableId);
            if (tableElem) {
                tableElem.innerHTML = html;
            }            
            // Add input Edit Listener
            const table = document.querySelector(`#${displayTableId} table`);
            if (table) {
                table.addEventListener('input', handleCellEdit);
            }
        } catch (err) {
            console.log(err);
        }
    }

    /**
    * Display Preview URL
    */
    function displayOnlineOfficePreview(previewUrl) {
        try {
            var iframeHtml = `<iframe 
                src="${previewUrl}" 
                width="100%" 
                height="100vh" 
                frameborder="0">
            </iframe>`;
            var previewContentElem = document.querySelector(".preview-content");
            if (previewContentElem) {
                previewContentElem.innerHTML = iframeHtml;
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
     * 把download url 直接嵌入iframe里面
     * 服务端拼接: 无Domain的 url
     * fileUrl: http://127.0.0.1:5000/files-wd/preview/user_d661/50d12f04-1ad0-458d-ab05-3bb474e44654/2508.21088v1.pdf
     * */
    async function displayIframePreview(fileUrl) {
        try {
            // .preview-section .preview-content.
            const previewContent = document.querySelector(".preview-content");
            if (previewContent) {
                previewContent.innerHTML = `<iframe src="${fileUrl}"></iframe>`;
            }
        } catch (err) {
            console.error(err);
        }
    }

        /**
     * 把download url 直接嵌入iframe里面
     * 服务端拼接: 无Domain的 url
     * fileUrl: http://127.0.0.1:5000/files-wd/preview-url/user_d661/50d12f04-1ad0-458d-ab05-3bb474e44654/2508.21088v1.pdf
     * */
    async function displayPlainTextPreview(fileUrl) {
        try {
            // .preview-section .preview-content.
            const previewContent = document.querySelector(".preview-content");
            if (previewContent) {
                const response = await fetch(fileUrl);

                // 检查请求是否成功
                if (!response.ok) {
                    console.error(`Failed to Fetch url {fileUrl}`);
                    return;
                }
                // 将响应内容作为文本读取
                const textContent = await response.text();
                previewContent.innerHTML = `<div class="preview-plain-text-wrapper"><pre>${textContent}</pre></div>`;
            }
        } catch (err) {
            console.error(err);
        }
    }

    /**
    * Display Preview URL of a folder
     * fileFullURL:
     * http://127.0.0.1:5000/files-wd/download/user_4928/7ee23cbc-6a40-4e1c-8812-477ed8d54320/
     * curl, return list of [file_name, download_url]
     *
    */
    async function displayFolderPreview(fileFullURL) {
        try {
            const response = await fetch(fileFullURL, {
                method: 'GET'
            });
            if (!response.ok) {
                // Fail

            } else {
                // upload results
                const result = await response.json();
                var file_list = result?.file_list;
                var file_item_merge_html = "";
                if (file_list != null && file_list.length > 0) {
                    for (var i = 0; i < file_list.length; i++) {
                        var fileobj = file_list[i];
                        var filename = fileobj?.name;
                        var filepath = fileobj?.path;
                        // 没有domain的路径
                        var download_url = fileobj?.download_url;
                        var type = fileobj?.type;
                        var file_item_html = "";
                        if (type == "file") {
                            file_item_html = `<div class="preview-file-item file"><div class="file-icon">📄</div><div class="preview-file-name"><a>${filepath}</a></div><button class="download-btn" data-url="${download_url}">Download</button></div>`;
                        } else if (type == "folder") {
                            file_item_html = `<div class="preview-file-item directory"><div class="file-icon">📁</div><div class="preview-folder-name"><a>${filepath}</a></div></div>`;
                        }
                        file_item_merge_html += file_item_html;
                    }
                } else {
                    file_item_merge_html = `No Files in this Web Folder`;
                }
                // .preview-section .preview-content.
                const previewContent = document.querySelector(".preview-content");
                if (previewContent) {
                    previewContent.innerHTML = `<div class="file-list-wrapper"><div class="file-list">${file_item_merge_html}</div></div>`;
                }
            }
        } catch (err) {
            console.error(err);
        }
    }

    // Process Excel Edit
    function handleCellEdit(event) {
        if (!workbook || !worksheet) return;
        
        const cell = event.target.closest('td');
        if (!cell) return;
        
        // Get Cell Position
        const cellAddress = cell.getAttribute('data-address');
        if (cellAddress) {
            // Upload Cell
            worksheet[cellAddress] = { v: event.target.textContent };
        }
    }


    function closePreview() {

        try {

            const mainContentDiv = document.querySelector(".main-content");
            const previewSectionDiv = document.querySelector(".preview-section");
            const mcpServerListDiv = document.querySelector(".mcp-servers-list-container");

            if (mainContentDiv == null || previewSectionDiv == null || mcpServerListDiv == null) {
                console.log("openFilePreview find mainContentDiv or previewSectionDiv or mcpServerListDiv missing...")
                return;
            }

            mainContentDiv.classList.toggle('collapsed');
            previewSectionDiv.classList.toggle('active');
            mcpServerListDiv.classList.toggle('close');

            isPreviewOpen = false;
            
            if (!isPreviewOpen) {
                // 停止更新检查
                // stopUpdateCheck();
                
                // 清空iframe
                // previewFrame.src = '';
            }
        } catch (err) {

        }

    }
    
    function toggleMediaModal() {
        const modal = document.getElementById('mediaModal');
        if (modal) {
            modal.classList.toggle('active');
        }
    }

    /**
    * display mediaClickedElem in modal 
    */
    function showModalMedia(mediaClickedElem) {
        try {
            // 
            const mediaElemNew = mediaClickedElem.cloneNode(true);
            mediaElemNew.classList.remove("message_media_display");
            mediaElemNew.classList.add("message_media_display_large");

            const modal = document.getElementById('mediaModal');
            var panelHeader = modal.querySelector(".panel-header-large");
            if (panelHeader) {
                // Clear all headers
                panelHeader.querySelectorAll('h1').forEach(h1 => h1.remove());
                panelHeader.querySelectorAll('h2').forEach(h2 => h2.remove());
                panelHeader.querySelectorAll('h3').forEach(h3 => h3.remove());

                var closeButton = panelHeader.querySelector('.close-panel');
                var alt = mediaClickedElem?.alt;
                var headerHtml = "";
                if (alt != null) {
                    headerHtml = `<h3>${alt}</h3>`;
                }
                closeButton.insertAdjacentHTML('beforebegin', headerHtml);
            }
            var panelContent = modal.querySelector(".panel-content-large");
            if (panelContent) {
                panelContent.innerHTML = "";
                panelContent.appendChild(mediaElemNew);
            }
        } catch (err) {
            console.log(err);
        }
    }

    chatContainerDiv.addEventListener('click', (e) => {

        // get message
        const clickMessageDiv = e.target.closest('.message');
        if (!clickMessageDiv) return;
        var messageId = clickMessageDiv.id;
        if (e.target.closest('.agent-chat-toolbar-copy')) {
            var messageContext = "";
            for (const node of clickMessageDiv.children) {
                if (!node.classList.contains("agent-chat-conv-ai-toolbar")) {
                    messageContext += (node.textContent + " ");
                }
            }
            copyToClipboard(messageContext);

        } else if (e.target.closest('.agent-chat-toolbar-like')) {

            userActionToolbar("UPVOTE");

        } else if (e.target.closest('.agent-chat-toolbar-dislike')) {

            userActionToolbar("DOWNVOTE");

        } else if (e.target.closest('.agent-chat-toolbar-share')) {
            shareMessage(messageId);
        } else if (e.target.closest('.login-text-url')) {
            // send back by python backend
            // login page
            toggleUserLoginModal();
        } else if (e.target.closest('.message_file_display_wrapper')) {
            const fileIconWrapper = e.target.closest('.message_file_display_wrapper');
            openFilePreview(fileIconWrapper);
            // click on file button to enlarge the preview section
            // login page
        } else if (e.target.closest('.message_media_display')) {
            // toggle modal an enable media
            toggleMediaModal();
            const mediaClicked = e.target.closest('.message_media_display');
            showModalMedia(mediaClicked);
        } else {
        
        }
    });

    if (previewSectionDiv) {

        previewSectionDiv.addEventListener('click', (e) => {
            if (e.target.closest('.preview-close-btn')) {
                closePreview();
            }
        });
    }

    // if (imageUploadBtn) {

    // }

    // drag and drop
    function highlightDrag() {
        dropArea.classList.add('dragover');
    }
    function unhighlightDrag() {
        dropArea.classList.remove('dragover');
    }

    async function handleDragUploadFiles(files) {

        let successCount = 0;
        let failCount = 0;
        try {
                if (!files || files.length === 0) return;
                if (files.length > 4) {
                    showHint(`Upload maximum 4 files at the same time.`, fileUploadBtn);
                    // e.target.value = '';
                    return;
                }
                var uploadResultArray = [];

                // Iterate Over Files
                for (const file of files) {
                    // 1. Check File Extension Supported
                    const extension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
                    if (!validDragUploadExtensions.includes(extension)) {
                        showHint(`${extension} is not supported uploaded file type...`, fileUploadBtn);
                        return;
                    }

                    // 2. File Size Restriction
                    const maxSize = 30 * 1024 * 1024; // 10MB
                    if (file.size > maxSize) {
                        showHint(`File Size Should Not Exceed ${maxSize/(1024 * 1024)} MB`, fileUploadBtn);
                        // e.target.value = '';
                        return;
                    }

                    // 3. Upload Files
                    try {
                        var targetURL = "";
                        if (validMediaExtensions.includes(extension)) {
                            targetURL = `/files-wd/upload/media/${uploadUserId}/${uploadDialogueSessionId}`;
                        } else if (validFileExtensions.includes(extension)) {
                            targetURL = `/files-wd/upload/file/${uploadUserId}/${uploadDialogueSessionId}`;
                        } else {
                            targetURL = `/files-wd/upload/file/${uploadUserId}/${uploadDialogueSessionId}`;
                        }
                        const formData = new FormData();
                        formData.append('file', file);
                        const response = await fetch(targetURL, {
                            method: 'POST',
                            body: formData
                        });

                        if (!response.ok) { 
                            // Fail
                            failCount += 1;
                        } else {

                            // upload results
                            successCount += 1;
                            const result = await response.json();
                            uploadResultArray.push(result);
                        }
                    } catch (err) {
                        console.error(err);
                        showHint(`Upload Failed. Please try again later.`, fileUploadBtn);
                    }


                }

                showHint(`Upload Successfully ${successCount} and Failed ${failCount}`, fileUploadBtn);

                // Chat Div Create Message
                var uploadFileHtml = generateUploadFileHtmlMutiple(uploadResultArray);
                var newUploadMessageId = generateUUID();
                // Add Message to HTML
                addMessageToChatboxHtmlWrapper(newUploadMessageId, messageClsUserOutgoing, uploadFileHtml);
                // update ChatHistory JS Variables
                chatHistory.push({role: 'user', content: uploadFileHtml});                

        } catch (err) {
            console.error(err);
        }
    }

    const dropArea = document.querySelector('.drop-area');
    
    function highlightDrag(e) {
        dropArea.classList.add('dragover_highlight');
    }
    
    function unhighlightDrag(e) {
        if (e.type === 'drop') {
            dropArea.classList.remove('dragover_highlight');
            return;
        }
        const rect = dropArea.getBoundingClientRect();
        const isOutside = (
            e.clientX <= rect.left - 1 ||
            e.clientX >= rect.right + 1 ||
            e.clientY <= rect.top - 1 ||
            e.clientY >= rect.bottom + 1
        );
        if (isOutside) {
            dropArea.classList.remove('dragover_highlight');
        }
    }

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    if (dropArea) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, preventDefaults, false);
        });
        ['dragenter', 'dragover'].forEach(eventName => {
            dropArea.addEventListener(eventName, highlightDrag, false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropArea.addEventListener(eventName, unhighlightDrag, false);
        });
        dropArea.addEventListener('drop', async (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            handleDragUploadFiles(files);
        }, false);
    }


    // query suggest Search Input
    // const searchInput = document.getElementById('searchInput');
    // const sendBtn = document.getElementById('sendBtn');
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    
    let debounceTimer;
    // 防抖延迟时间(ms)
    const debounceTime = 300;
    // Track if the sug displayed before?
    let hasDisplayedOnce = false;

    // 防抖函数
    function debounce(func, delay) {
        return function() {
            const context = this;
            const args = arguments;
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => func.apply(context, args), delay);
        };
    }

    sendBtn.addEventListener('click', () => {
        const query = searchInput.value.trim();
        if (query) {
            // alert(`Start Search: ${query}`);
            // 实际应用中这里可以提交搜索表单或跳转到搜索结果页
        }
    });
    
    // 支持回车键搜索
    searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            const query = searchInput.value.trim();
            if (query) {
            }
        }
    });
    
    searchInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = (this.scrollHeight) + 'px';
    });

    function addMultiTabResultEventListener() {
        document.addEventListener('click', function(event) {
            const button = event.target.closest('.tab-button');
            if (!button) return;

            const targetTabId = button.getAttribute('data-tab');
            const tabContents = document.querySelectorAll('.tab-content'); // 注意：这里会选中页面所有Tab内容

            document.querySelectorAll('.tab-button').forEach(btn => {
                btn.classList.remove('active');
                btn.setAttribute('aria-selected', 'false');
            });

            tabContents.forEach(content => {
                content.classList.remove('active');
            });

            // 激活当前点击的Tab和对应的内容区域
            button.classList.add('active');
            button.setAttribute('aria-selected', 'true');
            const targetContent = document.getElementById(targetTabId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    }

    /**     *
     * /agent/repo_id/user_id
     * /agent/AI-Hub-Admin/omni-doc-assistant-agent
     * */
    function getAgentOwnerRepoFromURL() {
        try {
            var agentValue = "";
            const path = window.location.pathname;
            const agentIndex = path.indexOf('/agent/');
            if (agentIndex !== -1) {
                // 截取/agent/后面的部分
                const agentPath = path.substring(agentIndex + 7);
                const pathParts = agentPath.split('/');

                // 确保路径格式正确（至少包含owner和repo两部分）
                if (pathParts.length >= 2) {
                    const owner = pathParts[0];
                    const repo = pathParts[1];
                    agentValue = `${owner}/${repo}`;
                }
            }
            return agentValue;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    /**
     * 从URL路径获取 agent选择的key
     * */
    function getMcpServerOwnerRepoFromURL() {
        try {
            var serverValue = "";
            const path = window.location.pathname;
            const serverIndex = path.indexOf('/mcp/');
            if (serverIndex !== -1) {
                // 截取/agent/后面的部分
                const serverPath = path.substring(serverIndex + 5);
                const serverParts = serverPath.split('/');
                // 确保路径格式正确（至少包含owner和repo两部分）
                if (serverParts.length >= 2) {
                    serverValue = `${serverParts[0]}/${serverParts[1]}`;
                }
            }
            return serverValue;
        } catch (err) {
            console.error(err);
            return "";
        }
    }

    /**
     * Send Initialized Greeting Message
     * */
    async function sendInitGreetingMessage() {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            var agentValue = urlParams.get('agent');
            var serverValue = urlParams.get('server');
            var queryValue = urlParams.get('q');
            // second: /agent/AI-Hub-Admin/omni-doc-assistant-agent
            if (!agentValue) {
                agentValue = getAgentOwnerRepoFromURL();
            }
            if (!serverValue) {
                serverValue = getMcpServerOwnerRepoFromURL();
            }
            var serverChatItemList = document.querySelectorAll(".sidebar-chat-item");
            var serverIdToImageDict = {};
            if (serverChatItemList) {
                serverChatItemList.forEach(p=> {
                    var thumbnailImageElem = p.querySelector(".display_card_image_thumbnail_img_small");
                    var serverIdElem = p.querySelector(".server-id");
                    if (serverIdElem != null && thumbnailImageElem != null) {
                        var thumbnailURL = thumbnailImageElem.src;
                        var serverId = serverIdElem.textContent;
                        if (serverId != "" && thumbnailURL != "") {
                             serverIdToImageDict[serverId] = thumbnailURL;
                        }
                    }
                });
            }
            var serverIdElemList = document.querySelectorAll(".server-id");
            var serverIdValueList = [];
            serverIdElemList.forEach(serverElem => {
                var serverId = serverElem.textContent;
                serverIdValueList.push(serverId);
            })
            var defaultAgentIcon = `<img class="agent_display_icon" src="/${agentName}/static/img/aiagenta2z_logo_green.png">`;
            var defaultGreeting = "<p>Hi, I am A2Z Payment AI Agent who can help you with multiple payment workflows on preview-to-pay, e-commerce checkout, cost-based payment, tipping/red envelop and more... This is a sandbox environment and you can use stripe/paypal sandbox account to complete the transaction safely. Try to Ask: Generate Image or Buy a present...</p>";
            var messageHtml = "";
            if (agentValue != null && serverValue != null) {
                // agent为主,
                if (serverIdToImageDict.hasOwnProperty(agentValue)) {
                    var thumbnailUrL = serverIdToImageDict[agentValue];
                    if (thumbnailUrL) {
                        var thumbnailUrlHtml = `<img class="display_card_image_thumbnail_img_small" src="${thumbnailUrL}">`;
                        messageHtml = thumbnailUrlHtml + `<p>Hi, I am AI Agent (${agentValue}) and I am willing to help you with your daily tasks</p>`;
                    }
                }
            } else if (agentValue == null && serverValue != null) {
                if (serverIdToImageDict.hasOwnProperty(serverValue)) {
                    var thumbnailUrL = serverIdToImageDict[serverValue];
                    if (thumbnailUrL) {
                        var thumbnailUrlHtml = `<img class="display_card_image_thumbnail_img_small" src="${thumbnailUrL}">`;
                        messageHtml = thumbnailUrlHtml + `<p>Hi, I am the Agent MCP Server(${serverValue}) and I can help you with your daily tasks</p>`;
                    }
                }
            } else if (agentValue != null && serverValue == null) {
                if (serverIdToImageDict.hasOwnProperty(agentValue)) {
                    var thumbnailUrL = serverIdToImageDict[agentValue];
                    if (thumbnailUrL) {
                        var thumbnailUrlHtml = `<img class="display_card_image_thumbnail_img_small" src="${thumbnailUrL}">`;
                        messageHtml = thumbnailUrlHtml + `<p>Hi, I am AI Agent (${agentValue}) and I can help you with your daily tasks</p>`;
                    }
                }
            } else {
                messageHtml = defaultAgentIcon + defaultGreeting;
            }
            if (messageHtml == "") {
                messageHtml = defaultAgentIcon + defaultGreeting;
            }

            var messageIconWrapperHtml = `<div class="message_icon_wrapper">${messageHtml}</div>`

            var newGreetingMessageId = generateUUID();
            // upload file JS Variables
            addMessageToChatboxHtmlWrapper(newGreetingMessageId, messageClsAssistantIncoming, messageIconWrapperHtml);

        } catch (err) {
            console.error(err);
        }
    }

    // loaded send first greeting message
    sendInitGreetingMessage();

});
