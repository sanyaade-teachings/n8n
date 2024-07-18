import { chatWithAssistant, replaceCode } from '@/api/assistant';
import { VIEWS } from '@/constants';
import { EDITABLE_CANVAS_VIEWS, STORES } from '@/constants';
import type { ChatRequest } from '@/types/assistant.types';
import type { ChatUI } from 'n8n-design-system/types/assistant';
import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import { useRootStore } from './root.store';
import { useUsersStore } from './users.store';
import { useRoute } from 'vue-router';
import { useSettingsStore } from './settings.store';
import { assert } from '@/utils/assert';
import { useWorkflowsStore } from './workflows.store';
import { INodeParameters, deepCopy } from 'n8n-workflow';

const MAX_CHAT_WIDTH = 425;
const MIN_CHAT_WIDTH = 250;
const ENABLED_VIEWS = [...EDITABLE_CANVAS_VIEWS, VIEWS.EXECUTION_PREVIEW];

export const useAssistantStore = defineStore(STORES.ASSISTANT, () => {
	const chatWidth = ref<number>(275);

	const settings = useSettingsStore();
	const rootStore = useRootStore();
	const chatMessages = ref<ChatUI.AssistantMessage[]>([]);
	const chatWindowOpen = ref<boolean>(false);
	const usersStore = useUsersStore();
	const workflowsStore = useWorkflowsStore();
	const route = useRoute();

	const suggestions = ref<{
		[suggestionId: string]: {
			previous: INodeParameters;
			suggested: INodeParameters;
		};
	}>({});
	const chatSessionError = ref<ChatRequest.ErrorContext | undefined>();
	const currentSessionId = ref<string | undefined>();

	const canShowAssistant = computed(
		() =>
			settings.isAiAssistantEnabled && route.name && ENABLED_VIEWS.includes(route.name as VIEWS),
	);

	const isAssistantOpen = computed(() => canShowAssistant.value && chatWindowOpen.value);

	const canShowAssistantButtons = computed(
		() =>
			settings.isAiAssistantEnabled &&
			route.name &&
			EDITABLE_CANVAS_VIEWS.includes(route.name as VIEWS),
	);

	function closeChat() {
		chatWindowOpen.value = false;
	}

	function openChat() {
		chatWindowOpen.value = true;
	}

	function addAssistantMessages(assistantMessages: ChatRequest.MessageResponse[]) {
		assistantMessages.forEach((message) => {
			if (message.type === 'assistant-message') {
				chatMessages.value.push({
					type: 'text',
					role: 'assistant',
					content: message.content,
					title: message.title,
					quickReplies: message.quickReplies,
				});
			} else if (message.type === 'code-diff') {
				chatMessages.value.push({
					role: 'assistant',
					type: 'code-diff',
					description: message.description,
					codeDiff: message.codeDiff,
					suggestionId: message.suggestionId,
					quickReplies: message.quickReplies,
				});
			}
		});
	}

	function updateWindowWidth(width: number) {
		chatWidth.value = Math.min(Math.max(width, MIN_CHAT_WIDTH), MAX_CHAT_WIDTH);
	}

	function isNodeErrorActive(context: ChatRequest.ErrorContext) {
		const targetNode = context.node.name;
		const errorMessage = context.error.message;

		return (
			targetNode === chatSessionError.value?.node.name &&
			errorMessage === chatSessionError.value?.error.message
		);
	}

	function clearMessages() {
		chatMessages.value = [];
	}

	function stopStreaming() {
		chatMessages.value = chatMessages.value
			.filter((message) => 'content' in message && !!message.content)
			.map((message) => {
				if ('streaming' in message && message.streaming) {
					message.streaming = false;
				}
				return message;
			});
	}

	function addAssistantError(content: string) {
		chatMessages.value.push({
			role: 'assistant',
			type: 'error',
			content,
		});
	}

	function addAssistantLoading() {
		chatMessages.value.push({
			role: 'assistant',
			type: 'text',
			content: '',
			streaming: true,
		});
	}

	function addUserMessage(content: string) {
		chatMessages.value.push({
			role: 'user',
			type: 'text',
			content,
		});
	}

	function handleServiceError(e: unknown) {
		assert(e instanceof Error);
		stopStreaming();
		addAssistantError(`There was an error reaching the service: (${e.message})`);
	}

	async function initErrorHelper(context: ChatRequest.ErrorContext) {
		if (isNodeErrorActive(context)) {
			return;
		}
		clearMessages();
		chatSessionError.value = context;

		addAssistantLoading();
		openChat();

		try {
			const response = await chatWithAssistant(rootStore.restApiContext, {
				action: 'init-error-help',
				user: {
					firstName: usersStore.currentUser?.firstName ?? '',
				},
				error: context.error,
				node: context.node,
				// executionSchema todo
			});
			currentSessionId.value = response.sessionId;
			stopStreaming();
			addAssistantMessages(response.messages);
		} catch (e: unknown) {
			handleServiceError(e);
		}
	}

	// async function sendEvent(eventName: ChatRequest.InteractionEventName) {
	// 	await chatWithAssistant(rootStore.restApiContext, {
	// 		type: 'event',
	// 		event: eventName,
	// 	});
	// }

	async function sendMessage(
		message: Pick<ChatRequest.UserChatMessage, 'content' | 'quickReplyType'>,
	) {
		addUserMessage(message.content);
		addAssistantLoading();

		try {
			const { messages } = await chatWithAssistant(rootStore.restApiContext, {
				action: 'user-message',
				content: message.content,
				quickReplyType: message.quickReplyType,
			});

			addAssistantMessages(messages);
			stopStreaming();
		} catch (e: unknown) {
			handleServiceError(e);
		}
	}

	function updateParameters(nodeName: string, parameters: INodeParameters) {
		workflowsStore.setNodeParameters(
			{
				name: nodeName,
				value: parameters,
			},
			true,
		);
	}

	function getRelevantParameters(
		parameters: INodeParameters,
		keysToKeep: string[],
	): INodeParameters {
		return keysToKeep.reduce((accu: INodeParameters, key: string) => {
			accu[key] = deepCopy(parameters[key]);
			return accu;
		}, {} as INodeParameters);
	}

	async function applyCodeDiff(index: number) {
		const codeDiffMessage = chatMessages.value[index];
		if (!codeDiffMessage || codeDiffMessage.type !== 'code-diff') {
			throw new Error('No code diff to apply');
		}

		try {
			assert(chatSessionError.value);
			assert(currentSessionId.value);

			codeDiffMessage.replacing = true;
			const suggestionId = codeDiffMessage.suggestionId;
			const { parameters: suggested } = await replaceCode(rootStore.restApiContext, {
				suggestionId: codeDiffMessage.suggestionId,
				sessionId: currentSessionId.value,
			});

			const currentWorkflow = workflowsStore.getCurrentWorkflow();
			const activeNode = currentWorkflow.getNode(chatSessionError.value.node.name);
			assert(activeNode);

			suggestions.value[suggestionId] = {
				previous: getRelevantParameters(activeNode.parameters, Object.keys(suggested)),
				suggested,
			};
			updateParameters(activeNode.name, suggested);

			codeDiffMessage.replaced = true;
		} catch (e) {
			console.error(e);
			codeDiffMessage.error = true;
		}
		codeDiffMessage.replacing = false;
	}

	async function undoCodeDiff(index: number) {
		// todo
	}

	return {
		chatWidth,
		chatMessages,
		isAssistantOpen,
		canShowAssistant,
		canShowAssistantButtons,
		closeChat,
		openChat,
		updateWindowWidth,
		isNodeErrorActive,
		initErrorHelper,
		sendMessage,
		applyCodeDiff,
		undoCodeDiff,
	};
});
