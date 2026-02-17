import { App, Plugin, PluginSettingTab, Setting, requestUrl, Notice } from 'obsidian';

// 플러그인 설정 인터페이스 정의
interface AIAgentSettings {
	baseUrl: string;
	apiKey: string;
	model: string;
	systemPrompt: string;
}

// 초기 설정값 (Ollama 기본값 세팅)
const DEFAULT_SETTINGS: AIAgentSettings = {
	baseUrl: 'http://localhost:11434/v1', 
	apiKey: 'ollama', 
	model: 'llama3',
	systemPrompt: 'You are a helpful assistant integrated into Obsidian.'
}

export default class AIAgentPlugin extends Plugin {
	settings: AIAgentSettings;

	async onload() {
		await this.loadSettings();

		// 옵시디언 왼쪽 리본 바에 아이콘 추가
		this.addRibbonIcon('bot', 'AI 에이전트 실행', async () => {
			const activeFile = this.app.workspace.getActiveFile();
			if (!activeFile) {
				new Notice('분석할 파일을 먼저 열어주세요.');
				return;
			}
			
			const content = await this.app.vault.read(activeFile);
			new Notice('로컬 AI가 노트를 분석 중입니다...');
			
			try {
				const response = await this.callLocalAI(content);
				
				// 결과물을 현재 노트 하단에 추가
				await this.app.vault.process(activeFile, (data) => {
					return data + "\n\n--- \n### 🤖 AI 분석 결과\n" + response;
				});
				new Notice('분석이 완료되었습니다!');
			} catch (e) {
				new Notice('로컬 AI 서버 연결 실패! 설정을 확인하세요.');
				console.error(e);
			}
		});

		// 설정 탭 등록
		this.addSettingTab(new AIAgentSettingTab(this.app, this));
	}

	// 로컬 AI 서버(Ollama/LM Studio 등)와 통신하는 함수
	async callLocalAI(prompt: string): Promise<string> {
		const { baseUrl, apiKey, model, systemPrompt } = this.settings;

		// 엔드포인트 URL 정리
		const url = `${baseUrl.replace(/\/+$/, '')}/chat/completions`;

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
				temperature: 0.7,
				stream: false
			})
		});

		if (response.status !== 200) {
			throw new Error(`API Error: ${response.status}`);
		}

		const json = response.json;
		return json.choices[0].message.content;
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

// 설정 화면 UI 클래스
class AIAgentSettingTab extends PluginSettingTab {
	plugin: AIAgentPlugin;

	constructor(app: App, plugin: AIAgentPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		containerEl.createEl('h2', { text: '로컬 AI 에이전트 설정' });

		new Setting(containerEl)
			.setName('서버 주소 (Base URL)')
			.setDesc('로컬 AI 서버의 API 주소를 입력하세요. (Ollama: http://localhost:11434/v1)')
			.addText(text => text
				.setPlaceholder('http://localhost:11434/v1')
				.setValue(this.plugin.settings.baseUrl)
				.onChange(async (value) => {
					this.plugin.settings.baseUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('모델 이름 (Model Name)')
			.setDesc('사용할 로컬 모델명을 입력하세요. (예: llama3, mistral, gemma)')
			.addText(text => text
				.setPlaceholder('llama3')
				.setValue(this.plugin.settings.model)
				.onChange(async (value) => {
					this.plugin.settings.model = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('API 키 (필요 시)')
			.setDesc('로컬 서버에서 키가 필요한 경우 입력하세요. (보통은 무시 가능)')
			.addText(text => text
				.setPlaceholder('ollama')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('시스템 프롬프트')
			.setDesc('AI의 역할이나 말투를 정의합니다.')
			.addTextArea(text => text
				.setPlaceholder('당신은 옵시디언 노트를 요약하는 전문가입니다.')
				.setValue(this.plugin.settings.systemPrompt)
				.onChange(async (value) => {
					this.plugin.settings.systemPrompt = value;
					await this.plugin.saveSettings();
				}));
	}
}
