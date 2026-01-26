// src/pages/ChatPage.jsx - AI Assistant Chat Interface with Zustand State Management
import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Send, 
  Bot, 
  User, 
  Loader2, 
  MessageSquare,
  Sparkles,
  FileText,
  AlertCircle
} from 'lucide-react';
import { useBackend } from '../contexts/BackendContext';
import { backendApi } from '../services/api';
import useAppStore from '../stores/appStore';
import toast from 'react-hot-toast';

const ChatPage = () => {
  const { isConnected, isLLMAvailable, activeSessions } = useBackend();
  
  // Get state and actions from Zustand
  const {
    chatMessages,
    selectedChatSession,
    contextType,
    isLoading,
    setChatMessages,
    addChatMessage,
    clearChatMessages,
    setSelectedChatSession,
    setContextType,
    setChatLoading,
  } = useAppStore((state) => ({
    chatMessages: state.chatMessages,
    selectedChatSession: state.selectedChatSession,
    contextType: state.contextType,
    isLoading: state.isLoading,
    setChatMessages: state.setChatMessages,
    addChatMessage: state.addChatMessage,
    clearChatMessages: state.clearChatMessages,
    setSelectedChatSession: state.setSelectedChatSession,
    setContextType: state.setContextType,
    setChatLoading: state.setChatLoading,
  }));

  const [inputMessage, setInputMessage] = React.useState('');
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Auto-scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages]);

  // Welcome message
  useEffect(() => {
    if (chatMessages.length === 0 && isLLMAvailable) {
      addChatMessage({
        id: Date.now(),
        type: 'assistant',
        content: `👋 Hello! I'm your AI assistant for speech analysis. I can help you with:

• **General Questions**: Ask me anything about speech analysis, transcription, or AI
• **Transcript Analysis**: Select a processed session to analyze specific conversations
• **Insights & Summaries**: Get detailed analysis of your transcribed content

How can I assist you today?`,
        timestamp: new Date()
      });
    }
  }, [isLLMAvailable, chatMessages.length, addChatMessage]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date()
    };

    addChatMessage(userMessage);
    setInputMessage('');
    setChatLoading(true);

    try {
      const response = await backendApi.chatWithLLM({
        message: userMessage.content,
        session_id: selectedChatSession,
        context_type: contextType
      });

      const assistantMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: response.data.response,
        timestamp: new Date(),
        model: response.data.model
      };

      addChatMessage(assistantMessage);

    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage = {
        id: Date.now() + 1,
        type: 'assistant',
        content: `I apologize, but I encountered an error: ${error.userMessage || 'Unable to process your request'}. Please try again or check your connection.`,
        timestamp: new Date(),
        isError: true
      };

      addChatMessage(errorMessage);
      toast.error(error.userMessage || 'Chat request failed');
    } finally {
      setChatLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getSessionOptions = () => {
    return Array.from(activeSessions.entries())
      .filter(([_, sessionData]) => sessionData.status === 'completed')
      .map(([sessionId, sessionData]) => ({
        id: sessionId,
        name: `Session ${sessionId.slice(0, 8)}... (${sessionData.filename || 'Unknown'})`,
        status: sessionData.status
      }));
  };

  const formatMessageTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Connection checks
  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center bg-gray-800 rounded-2xl p-8 shadow-lg max-w-md border border-gray-700">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Backend Offline</h2>
          <p className="text-gray-300 mb-4">Please ensure the backend server is running.</p>
        </div>
      </div>
    );
  }

  if (!isLLMAvailable) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
        <div className="text-center bg-gray-800 rounded-2xl p-8 shadow-lg max-w-md border border-gray-700">
          <MessageSquare className="w-16 h-16 text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">LLM Unavailable</h2>
          <p className="text-gray-300 mb-4">Please check Ollama setup.</p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left text-sm">
            <div className="font-medium text-yellow-800 mb-2">To start Ollama:</div>
            <code className="block bg-white p-2 rounded border text-yellow-900">
              ollama serve
            </code>
            <div className="mt-2 text-yellow-700">
              Make sure the model is downloaded: <code>ollama pull llama3.2:3b</code>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
              <MessageSquare className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">AI Assistant</h1>
              <p className="text-gray-600">Chat with AI about your transcriptions and analysis</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 text-sm">
            <Sparkles className="w-4 h-4 text-green-500" />
            <span className="text-green-600 font-medium">LLM Ready</span>
          </div>
        </div>
      </div>

      {/* Context Selection */}
      <div className="mb-6 bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center space-x-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Chat Context
            </label>
            <select
              value={contextType}
              onChange={(e) => setContextType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="general">General Assistant</option>
              <option value="transcript">Transcript Analysis</option>
            </select>
          </div>

          {contextType === 'transcript' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Session
              </label>
              <select
                value={selectedChatSession}
                onChange={(e) => setSelectedChatSession(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                disabled={getSessionOptions().length === 0}
              >
                <option value="">
                  {getSessionOptions().length === 0 ? 'No completed sessions available' : 'Choose a session...'}
                </option>
                {getSessionOptions().map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex-1"></div>

          <button
            onClick={() => clearChatMessages()}
            className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
          >
            Clear Chat
          </button>
        </div>
      </div>

      {/* Chat Messages */}
      <div className="flex-1 bg-white rounded-xl border border-gray-200 mb-4 overflow-hidden flex flex-col">
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <AnimatePresence>
            {chatMessages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className={`flex items-start space-x-3 ${
                  message.type === 'user' ? 'flex-row-reverse space-x-reverse' : ''
                }`}
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  message.type === 'user' 
                    ? 'bg-purple-500' 
                    : message.isError 
                    ? 'bg-red-500' 
                    : 'bg-gray-700'
                }`}>
                  {message.type === 'user' ? (
                    <User className="w-4 h-4 text-white" />
                  ) : (
                    <Bot className="w-4 h-4 text-white" />
                  )}
                </div>
                
                <div className={`flex-1 max-w-3xl ${
                  message.type === 'user' ? 'text-right' : 'text-left'
                }`}>
                  <div className={`inline-block p-4 rounded-lg ${
                    message.type === 'user'
                      ? 'bg-purple-500 text-white'
                      : message.isError
                      ? 'bg-red-50 text-red-800 border border-red-200'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    <div className="whitespace-pre-wrap leading-relaxed">
                      {message.content}
                    </div>
                    {message.model && (
                      <div className="mt-2 text-xs opacity-70">
                        Model: {message.model}
                      </div>
                    )}
                  </div>
                  
                  <div className={`mt-1 text-xs text-gray-500 ${
                    message.type === 'user' ? 'text-right' : 'text-left'
                  }`}>
                    {formatMessageTime(message.timestamp)}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Loading indicator */}
          {isLoading && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-start space-x-3"
            >
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <div className="inline-block p-4 bg-gray-100 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="w-4 h-4 animate-spin text-gray-600" />
                    <span className="text-gray-600">AI is thinking...</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-end space-x-4">
            <div className="flex-1">
              <textarea
                ref={inputRef}
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={
                  contextType === 'transcript' && selectedChatSession
                    ? 'Ask me about this transcript...'
                    : 'Ask me anything about speech analysis, AI, or transcription...'
                }
                className="w-full px-4 py-3 border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                rows="3"
                disabled={isLoading}
              />
              <div className="mt-2 flex items-center justify-between text-sm text-gray-500">
                <span>Press Enter to send, Shift+Enter for new line</span>
                {contextType === 'transcript' && selectedChatSession && (
                  <span className="text-purple-600">
                    Analyzing session {selectedChatSession.slice(0, 8)}...
                  </span>
                )}
              </div>
            </div>
            
            <button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || isLoading}
              className={`px-6 py-3 rounded-lg font-medium transition-all ${
                inputMessage.trim() && !isLoading
                  ? 'bg-purple-500 hover:bg-purple-600 text-white shadow-lg hover:shadow-xl'
                  : 'bg-gray-300 text-gray-500 cursor-not-allowed'
              }`}
            >
              {isLoading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Context Info */}
      {contextType === 'transcript' && !selectedChatSession && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <FileText className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
          <p className="text-yellow-800 font-medium">Transcript Analysis Mode</p>
          <p className="text-yellow-700 text-sm mt-1">
            Select a completed session above to ask questions about specific transcripts
          </p>
        </div>
      )}

      {contextType === 'transcript' && selectedChatSession && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-center">
          <MessageSquare className="w-8 h-8 text-purple-600 mx-auto mb-2" />
          <p className="text-purple-800 font-medium">Analyzing Session {selectedChatSession.slice(0, 8)}...</p>
          <p className="text-purple-700 text-sm mt-1">
            I can answer questions about this specific transcript, analyze sentiment, extract insights, and more
          </p>
        </div>
      )}

      {getSessionOptions().length === 0 && contextType === 'transcript' && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
          <AlertCircle className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-800 font-medium">No Completed Sessions</p>
          <p className="text-gray-600 text-sm mt-1">
            Process an audio file first to use transcript analysis mode
          </p>
        </div>
      )}
    </div>
  );
};

export default ChatPage;