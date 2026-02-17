const { Plugin, PluginSettingTab, Setting, requestUrl, Notice, ItemView } = require('obsidian');

// 사이드바 뷰를 위한 고유 ID
const VIEW_TYPE_SECOND_BRAIN = "second-brain-agent-view";

// 기본 설정값
const DEFAULT_SETTINGS = {
    provider: 'local', // 'openai' 또는 'local'
    baseUrl: 'http://localhost:11434/v1',
    apiKey: 'ollama',
    model: 'llama3',
    systemPrompt: '당신은 사용자의 지식 관리를 돕는 Second Brain AI 에이전트입니다. 한국어로 답변해 주세요.'
};

// 사이드바 채팅 UI 클래스 정의
class SecondBrainView extends ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
    }

    getViewType() { return VIEW_TYPE_SECOND_BRAIN; }
    getDisplayText() { return "Second Brain Agent"; }
    getIcon() { return "bot"; }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.style.display = 'flex';
        container.style.flexDirection = 'column';
        container.style.padding = '15px';
        container.style.gap = '10px';

        container.createEl('h3', { text: '🧠 Second Brain Agent' });

        // 채팅 기록 영역
        const chatLog = container.createEl('div', { cls: 'chat-log' });
        chatLog.style.flexGrow = '1';
        chatLog.style.overflowY = 'auto';
        chatLog.style.border = '1px solid var(--background-modifier-border)';
        chatLog.style.borderRadius = '8px';
        chatLog.style.padding = '10px';
        chatLog.style.backgroundColor = 'var(--background-primary)';

        // 입력창 영역
        const inputContainer = container.createEl('div');
        inputContainer.style.display = 'flex';
        inputContainer.style.flexDirection = 'column';
        inputContainer.style.gap = '8px';

        const inputField = inputContainer.createEl('textarea', { 
            placeholder: 'AI에게 질문을 입력하세요...',
            cls: 'chat-input'
        });
        inputField.style.width = '100%';
        inputField.style.height = '80px';
        inputField.style.borderRadius = '5px';
        inputField.style.padding = '8px';
        inputField.style.resize = 'none';

        const sendButton = inputContainer.createEl('button', { text: '전송' });
        sendButton.style.width = '100%';
        sendButton.style.cursor = 'pointer';

        // 메시지 렌더링 함수
        const appendMessage = (role, text) => {
            const msgEl = chatLog.createEl('div');
            msgEl.style.marginBottom = '12px';
            msgEl.style.padding = '10px';
            msgEl.style.borderRadius = '8px';
            
            if (role === 'user') {
                msgEl.style.backgroundColor = 'var(--background-secondary-alt)';
                msgEl.innerHTML = `<div style="font-weight: bold; color: var(--text-accent); margin-bottom: 4px;">👤 나</div><div>${text.replace(/\n/g, '<br>')}</div>`;
            } else {
                msgEl.style.backgroundColor = 'var(--background-modifier-success-beta)';
                msgEl.innerHTML = `<div style="font-weight: bold; color: var(--text-success); margin-bottom: 4px;">🤖 AI</div><div>${text.replace(/\n/g, '<br>')}</div>`;
            }
            chatLog.scrollTop = chatLog.scrollHeight;
        };

        // 전송 버튼 클릭 이벤트
        sendButton.addEventListener('click', async () => {
            const query = inputField.value.trim();
            if (!query) return;

            appendMessage('user', query);
            inputField.value = '';

            try {
                const response = await this.plugin.callAI(query);
                appendMessage('ai', response);
            } catch (e) {
                appendMessage('ai', '에러: AI 서버에 연결할 수 없습니다. 설정을 확인해 주세요.');
                console.error(e);
            }
        });
    }
}

// 메인 플러그인 클래스
class AIAgentPlugin extends Plugin {
    async onload() {
        await this.loadSettings();

        // 사이드바 뷰 등록
        this.registerView(
            VIEW_TYPE_SECOND_BRAIN,
            (leaf) => new SecondBrainView(leaf, this)
        );

        // 왼쪽 리본 아이콘 추가
        this.addRibbonIcon('bot', 'Second Brain Agent 열기', () => {
            this.activateView();
        });

        // 설정 탭 추가
        this.addSettingTab(new AIAgentSettingTab(this.app, this));
    }

    // 사이드바 활성화 함수
    async activateView() {
        const { workspace } = this.app;
        let leaf = workspace.getLeavesOfType(VIEW_TYPE_SECOND_BRAIN)[0];

        if (!leaf) {
            leaf = workspace.getRightLeaf(false);
            await leaf.setViewState({ type: VIEW_TYPE_SECOND_BRAIN, active: true });
        }
        workspace.revealLeaf(leaf);
    }

    // AI API 호출 함수
    async callAI(prompt) {
        const { provider, baseUrl, apiKey, model, systemPrompt } = this.settings;
        
        const url = provider === 'openai' 
            ? 'https://api.openai.com/v1/chat/completions' 
            : `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

        const response = await requestUrl({
            url: url,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7
            })
        });

        if (response.status !== 200) {
            throw new Error(`API 오류: ${response.status}`);
        }

        return response.json.choices[0].message.content;
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }
}

// 설정 화면 클래스
class AIAgentSettingTab extends PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'Second Brain Agent 설정' });

        new Setting(containerEl)
            .setName('AI 프로바이더 선택')
            .setDesc('로컬 AI(Ollama 등) 또는 OpenAI를 선택하세요.')
            .addDropdown(dropdown => dropdown
                .addOption('local', '로컬 AI (Ollama / LM Studio)')
                .addOption('openai', 'OpenAI (GPT-4o 등)')
                .setValue(this.plugin.settings.provider)
                .onChange(async (value) => {
                    this.plugin.settings.provider = value;
                    await this.plugin.saveSettings();
                    this.display(); // UI 새로고침
                }));

        if (this.plugin.settings.provider === 'local') {
            new Setting(containerEl)
                .setName('로컬 서버 주소')
                .setDesc('Ollama 기본값: http://localhost:11434/v1')
                .addText(text => text
                    .setPlaceholder('http://localhost:11434/v1')
                    .setValue(this.plugin.settings.baseUrl)
                    .onChange(async (value) => {
                        this.plugin.settings.baseUrl = value;
                        await this.plugin.saveSettings();
                    }));
        }

        new Setting(containerEl)
            .setName('모델 이름')
            .setDesc('사용할 모델명을 정확히 입력하세요. (예: llama3, mistral, gpt-4o)')
            .addText(text => text
                .setPlaceholder('llama3')
                .setValue(this.plugin.settings.model)
                .onChange(async (value) => {
                    this.plugin.settings.model = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('API 키')
            .setDesc('OpenAI 사용 시 필요합니다. 로컬은 무시해도 됩니다.')
            .addText(text => text
                .setPlaceholder('sk-...')
                .setValue(this.plugin.settings.apiKey)
                .onChange(async (value) => {
                    this.plugin.settings.apiKey = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('시스템 프롬프트')
            .setDesc('AI의 성격과 역할을 정의합니다.')
            .addTextArea(text => text
                .setValue(this.plugin.settings.systemPrompt)
                .onChange(async (value) => {
                    this.plugin.settings.systemPrompt = value;
                    await this.plugin.saveSettings();
                }));
    }
}

module.exports = AIAgentPlugin;
