import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  Settings, 
  Search, 
  X,
  Trash2,
  Edit3,
  Eye,
  EyeOff,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { backendApi } from '../services/api';
import toast from 'react-hot-toast';

// AdminHeader Component - Updated with brand colors
const AdminHeader = ({ onRefresh, onCreatePrompt }) => {
  return (
    <div className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
            <p className="text-gray-600">Manage analysis prompts and system settings</p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={onRefresh}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg transition-colors shadow-sm hover:shadow-md"
            >
              <RefreshCw className="w-4 h-4" />
              <span>Refresh</span>
            </button>
            <button
              onClick={onCreatePrompt}
              className="flex items-center space-x-2 px-4 py-2 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg hover:opacity-90"
              style={{ background: 'linear-gradient(to right, #5AE8C7, #DF72E8)' }}
            >
              <Plus className="w-4 h-4" />
              <span>Add Prompt</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// AdminFilters Component - Updated with brand colors
const AdminFilters = ({ 
  searchTerm, 
  setSearchTerm, 
  selectedCategory, 
  setSelectedCategory, 
  categories, 
  filteredCount, 
  totalCount 
}) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search prompts..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:border-transparent shadow-sm"
              style={{ '--tw-ring-color': '#5AE8C7' }}
            />
          </div>
          
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:border-transparent shadow-sm"
            style={{ '--tw-ring-color': '#5AE8C7' }}
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {filteredCount} of {totalCount} prompts
        </div>
      </div>
    </div>
  );
};

// PromptCard Component - Updated with brand colors and styling
const PromptCard = ({ 
  prompt, 
  onEdit, 
  onToggleStatus, 
  onDelete, 
  getCategoryColor,
  getCategoryGradient 
}) => {
  // Get brand colors based on category
  const getBrandGradient = (category) => {
    const gradients = {
      general: 'linear-gradient(135deg, #5AE8C7 0%, #B7F0DE 100%)',
      meeting: 'linear-gradient(135deg, #5AE8C7 0%, #B7F0DE 100%)',
      content: 'linear-gradient(135deg, #DF72E8 0%, #EBD4F2 100%)',
      analysis: 'linear-gradient(135deg, #FFC700 0%, #FFF3B0 100%)',
      productivity: 'linear-gradient(135deg, #5AE8C7 0%, #DF72E8 100%)'
    };
    return gradients[category] || gradients.general;
  };

  const getBrandCategoryColor = (category) => {
    const colors = {
      general: '#5AE8C7',
      meeting: '#5AE8C7', 
      content: '#DF72E8',
      analysis: '#FFC700',
      productivity: '#5AE8C7'
    };
    return colors[category] || colors.general;
  };

  return (
    <motion.div
      key={prompt.id}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-all duration-200"
    >
      {/* Card Header with brand gradient */}
      <div 
        className="p-4"
        style={{ background: getBrandGradient(prompt.category) }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
              <span className="text-2xl">{prompt.emoji}</span>
            </div>
            <div className="text-white">
              <h3 className="font-semibold text-lg">{prompt.title}</h3>
              <p className="text-sm opacity-90 font-medium">{prompt.key}</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {prompt.is_system && (
              <div className="p-1 bg-white/20 rounded backdrop-blur-sm">
                <Settings className="w-3 h-3 text-white" />
              </div>
            )}
            <div className={`p-1 rounded backdrop-blur-sm ${prompt.is_active ? 'bg-white/20' : 'bg-red-500/30'}`}>
              {prompt.is_active ? 
                <Eye className="w-3 h-3 text-white" /> : 
                <EyeOff className="w-3 h-3 text-white" />
              }
            </div>
          </div>
        </div>
      </div>

      {/* Card Body with updated styling */}
      <div className="p-4 bg-gray-50">
        <p className="text-gray-700 text-sm mb-3 line-clamp-2 leading-relaxed">
          {prompt.description || 'No description provided'}
        </p>
        
        <div className="flex items-center justify-between text-xs text-gray-600 mb-4">
          <span 
            className="px-3 py-1 rounded-full text-white font-medium shadow-sm"
            style={{ backgroundColor: getBrandCategoryColor(prompt.category) }}
          >
            {prompt.category}
          </span>
          <span className="bg-gray-200 px-2 py-1 rounded-full">
            {prompt.usage_count} uses
          </span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <button
              onClick={() => onEdit(prompt)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-200"
              style={{ '--hover-color': '#5AE8C7' }}
              onMouseEnter={(e) => e.target.style.color = '#5AE8C7'}
              onMouseLeave={(e) => e.target.style.color = ''}
              title="Edit"
            >
              <Edit3 className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onToggleStatus(prompt)}
              className="p-2 text-gray-500 hover:text-gray-700 transition-colors rounded-lg hover:bg-gray-200"
              style={{ '--hover-color': prompt.is_active ? '#FFC700' : '#5AE8C7' }}
              onMouseEnter={(e) => e.target.style.color = prompt.is_active ? '#FFC700' : '#5AE8C7'}
              onMouseLeave={(e) => e.target.style.color = ''}
              title={prompt.is_active ? 'Deactivate' : 'Activate'}
            >
              {prompt.is_active ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
            
            {!prompt.is_system && (
              <button
                onClick={() => onDelete(prompt)}
                className="p-2 text-gray-500 hover:text-red-500 transition-colors rounded-lg hover:bg-gray-200"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
          
          <div className="text-xs text-gray-500 bg-gray-200 px-2 py-1 rounded-full">
            ~{prompt.estimated_time}s
          </div>
        </div>
      </div>
    </motion.div>
  );
};

// PromptModal Component - Updated with brand colors
const PromptModal = ({ 
  isOpen,
  isEditMode,
  formData,
  submitting,
  categories,
  onClose,
  onSubmit,
  onInputChange 
}) => {
  if (!isOpen) return null;

  // Brand gradient for preview
  const getPreviewGradient = (category) => {
    const gradients = {
      general: 'linear-gradient(135deg, #5AE8C7 0%, #B7F0DE 100%)',
      meeting: 'linear-gradient(135deg, #5AE8C7 0%, #B7F0DE 100%)',
      content: 'linear-gradient(135deg, #DF72E8 0%, #EBD4F2 100%)',
      analysis: 'linear-gradient(135deg, #FFC700 0%, #FFF3B0 100%)',
      productivity: 'linear-gradient(135deg, #5AE8C7 0%, #DF72E8 100%)'
    };
    return gradients[category] || gradients.general;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              {isEditMode ? 'Edit Prompt' : 'Create New Prompt'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
            {/* Key and Title */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Key* <span className="text-xs text-gray-500">(unique identifier)</span>
                </label>
                <input
                  type="text"
                  value={formData.key}
                  onChange={(e) => onInputChange('key', e.target.value)}
                  placeholder="e.g., summary, action_items"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                  required
                  disabled={isEditMode}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Title*
                </label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => onInputChange('title', e.target.value)}
                  placeholder="Display name for the prompt"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                  required
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => onInputChange('description', e.target.value)}
                placeholder="Brief description of what this prompt does"
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 resize-none focus:ring-2 focus:border-transparent shadow-sm"
                style={{ '--tw-ring-color': '#5AE8C7' }}
              />
            </div>

            {/* Prompt Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Prompt Template*
                <span className="text-xs text-gray-500 ml-2">
                  (must include {'{transcript}'} placeholder)
                </span>
              </label>
              <textarea
                value={formData.prompt_template}
                onChange={(e) => onInputChange('prompt_template', e.target.value)}
                placeholder="Enter your prompt template here. Use {transcript} where the transcript should be inserted."
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 font-mono text-sm resize-none focus:ring-2 focus:border-transparent shadow-sm"
                style={{ '--tw-ring-color': '#5AE8C7' }}
                required
              />
              {formData.prompt_template && !formData.prompt_template.includes('{transcript}') && (
                <p className="text-red-500 text-xs mt-1">
                  ⚠️ Prompt template must contain {'{transcript}'} placeholder
                </p>
              )}
            </div>

            {/* Icon, Emoji, Category */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Icon
                </label>
                <select
                  value={formData.icon}
                  onChange={(e) => onInputChange('icon', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                >
                  <option value="Brain">Brain</option>
                  <option value="MessageSquare">MessageSquare</option>
                  <option value="FileText">FileText</option>
                  <option value="BarChart3">BarChart3</option>
                  <option value="Users">Users</option>
                  <option value="Calendar">Calendar</option>
                  <option value="HelpCircle">HelpCircle</option>
                  <option value="TrendingUp">TrendingUp</option>
                  <option value="Zap">Zap</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Emoji
                </label>
                <input
                  type="text"
                  value={formData.emoji}
                  onChange={(e) => onInputChange('emoji', e.target.value)}
                  placeholder="🤖"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 text-center focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) => onInputChange('category', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                >
                  {categories.filter(cat => cat.value !== 'all').map(category => (
                    <option key={category.value} value={category.value}>
                      {category.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Max Tokens and Estimated Time */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={formData.max_tokens}
                  onChange={(e) => onInputChange('max_tokens', parseInt(e.target.value))}
                  min="100"
                  max="8000"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Estimated Time (seconds)
                </label>
                <input
                  type="number"
                  value={formData.estimated_time}
                  onChange={(e) => onInputChange('estimated_time', parseFloat(e.target.value))}
                  min="1"
                  max="300"
                  step="0.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-gray-900 focus:ring-2 focus:border-transparent shadow-sm"
                  style={{ '--tw-ring-color': '#5AE8C7' }}
                />
              </div>
            </div>

            {/* Preview with brand styling */}
            <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Preview</h4>
              <div 
                className="p-4 rounded-lg text-white shadow-sm"
                style={{ background: getPreviewGradient(formData.category) }}
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-sm">
                    <span className="text-lg">{formData.emoji}</span>
                  </div>
                  <div>
                    <h5 className="font-medium text-lg">{formData.title || 'Prompt Title'}</h5>
                    <p className="text-sm opacity-90 font-medium">{formData.key || 'prompt_key'}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 bg-white border border-gray-300 rounded-lg transition-colors shadow-sm hover:shadow-md"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !formData.key || !formData.title || !formData.prompt_template || !formData.prompt_template.includes('{transcript}')}
                className="flex items-center space-x-2 px-6 py-2 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90"
                style={{ background: submitting || !formData.key || !formData.title || !formData.prompt_template || !formData.prompt_template.includes('{transcript}') 
                  ? '#9CA3AF' 
                  : 'linear-gradient(to right, #5AE8C7, #DF72E8)' 
                }}
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>{isEditMode ? 'Update Prompt' : 'Create Prompt'}</span>
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </div>
  );
};

// Main AdminDashboard Component - Updated with brand styling
const AdminDashboard = () => {
  // All existing state management preserved exactly as is
  const [prompts, setPrompts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Form data for creating/editing prompts - unchanged
  const [formData, setFormData] = useState(() => {
    const defaultGradient = { from: 'blue-500', to: 'blue-600' };
    return {
      key: '',
      title: '',
      description: '',
      prompt_template: '',
      icon: 'Brain',
      emoji: '🤖',
      category: 'general',
      gradient_from: defaultGradient.from,
      gradient_to: defaultGradient.to,
      max_tokens: 2000,
      estimated_time: 30.0
    };
  });

  const defaultCategories = [
    { value: 'all', label: 'All Categories', color: 'gray' },
    { value: 'general', label: 'General', color: 'blue' },
    { value: 'meeting', label: 'Meeting', color: 'green' },
    { value: 'content', label: 'Content', color: 'purple' },
    { value: 'analysis', label: 'Analysis', color: 'yellow' },
    { value: 'productivity', label: 'Productivity', color: 'orange' }
  ];

  // All existing useEffects and API functions preserved exactly
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!loading) {
      loadPrompts();
    }
  }, [selectedCategory]);

  // All existing functions preserved exactly as they were
  const loadInitialData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadPrompts(),
        loadCategories()
      ]);
    } catch (error) {
      console.error('Failed to load initial data:', error);
      toast.error('Failed to load admin data');
    } finally {
      setLoading(false);
    }
  };

  const loadPrompts = async () => {
    try {
      const response = await backendApi.prompts.getAll({
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        active_only: false
      });
      // Fix: Extract the prompts array from the response object
      setPrompts(response.data.prompts || response.data || []);
    } catch (error) {
      console.error('Failed to load prompts:', error);
      // Set empty array on error to prevent filter issues
      setPrompts([]);
      throw error;
    }
  };

  const loadCategories = async () => {
    try {
      const response = await backendApi.prompts.getCategories();
      setCategories(response.data.categories || defaultCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
      setCategories(defaultCategories);
    }
  };

  const handleCreatePrompt = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (!formData.key || !formData.title || !formData.prompt_template) {
        toast.error('Please fill in all required fields');
        return;
      }

      if (!formData.prompt_template.includes('{transcript}')) {
        toast.error('Prompt template must contain {transcript} placeholder');
        return;
      }

      await backendApi.prompts.create(formData);
      
      toast.success('Prompt created successfully!');
      setShowCreateModal(false);
      resetForm();
      await loadPrompts();
      
    } catch (error) {
      console.error('Failed to create prompt:', error);
      
      if (error.response?.status === 400) {
        toast.error(error.response.data.detail || 'Invalid prompt data');
      } else if (error.response?.status === 503) {
        toast.error('Database not available');
      } else {
        toast.error('Failed to create prompt');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditPrompt = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (!editingPrompt) return;

      await backendApi.prompts.update(editingPrompt.id, formData);
      
      toast.success('Prompt updated successfully!');
      setShowEditModal(false);
      setEditingPrompt(null);
      resetForm();
      await loadPrompts();
      
    } catch (error) {
      console.error('Failed to update prompt:', error);
      
      if (error.response?.status === 403) {
        toast.error('Cannot modify system prompts');
      } else if (error.response?.status === 404) {
        toast.error('Prompt not found');
      } else {
        toast.error('Failed to update prompt');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeletePrompt = async (prompt) => {
    if (!confirm(`Are you sure you want to delete "${prompt.title}"?`)) return;
    
    try {
      await backendApi.prompts.delete(prompt.id);
      toast.success('Prompt deleted successfully!');
      await loadPrompts();
      
    } catch (error) {
      console.error('Failed to delete prompt:', error);
      
      if (error.response?.status === 403) {
        toast.error('Cannot delete system prompts');
      } else if (error.response?.status === 404) {
        toast.error('Prompt not found');
      } else {
        toast.error('Failed to delete prompt');
      }
    }
  };

  const handleToggleStatus = async (prompt) => {
    try {
      await backendApi.prompts.toggle(prompt.key);
      toast.success(`Prompt ${prompt.is_active ? 'deactivated' : 'activated'} successfully!`);
      await loadPrompts();
      
    } catch (error) {
      console.error('Failed to toggle prompt status:', error);
      toast.error('Failed to update prompt status');
    }
  };

  const openEditModal = (prompt) => {
    setEditingPrompt(prompt);
    setFormData({
      key: prompt.key,
      title: prompt.title,
      description: prompt.description,
      prompt_template: prompt.prompt_template,
      icon: prompt.icon,
      emoji: prompt.emoji,
      category: prompt.category,
      gradient_from: prompt.gradient_from,
      gradient_to: prompt.gradient_to,
      max_tokens: prompt.max_tokens,
      estimated_time: prompt.estimated_time
    });
    setShowEditModal(true);
  };

  const resetForm = () => {
    const defaultGradient = getCategoryGradient('general');
    setFormData({
      key: '',
      title: '',
      description: '',
      prompt_template: '',
      icon: 'Brain',
      emoji: '🤖',
      category: 'general',
      gradient_from: defaultGradient.from,
      gradient_to: defaultGradient.to,
      max_tokens: 2000,
      estimated_time: 30.0
    });
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => {
      const newData = { ...prev, [field]: value };
      
      if (field === 'category') {
        const gradient = getCategoryGradient(value);
        newData.gradient_from = gradient.from;
        newData.gradient_to = gradient.to;
      }
      
      return newData;
    });
  };

  const handleCloseModal = () => {
    setShowCreateModal(false);
    setShowEditModal(false);
    setEditingPrompt(null);
    resetForm();
  };

  // Utility functions preserved
  const filteredPrompts = prompts.filter(prompt => {
    const matchesSearch = prompt.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         prompt.key.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || prompt.category === selectedCategory;
    
    return matchesSearch && matchesCategory;
  });

  const getCategoryColor = (category) => {
    const categoryColors = {
      general: 'blue',
      meeting: 'green', 
      content: 'purple',
      analysis: 'yellow',
      productivity: 'orange'
    };
    return categoryColors[category] || 'blue';
  };

  const getCategoryGradient = (category) => {
    const gradients = {
      general: { from: 'blue-500', to: 'blue-600' },
      meeting: { from: 'green-500', to: 'green-600' },
      content: { from: 'purple-500', to: 'purple-600' },
      analysis: { from: 'yellow-500', to: 'yellow-600' },
      productivity: { from: 'orange-500', to: 'orange-600' }
    };
    return gradients[category] || gradients.general;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4" style={{ color: '#5AE8C7' }} />
          <p className="text-gray-600">Loading admin dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <AdminHeader 
        onRefresh={loadInitialData}
        onCreatePrompt={() => setShowCreateModal(true)}
      />

      <div className="max-w-7xl mx-auto px-6 py-8">
        <AdminFilters 
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          categories={categories}
          filteredCount={filteredPrompts.length}
          totalCount={prompts.length}
        />

        {/* Prompts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPrompts.map((prompt) => (
            <PromptCard
              key={prompt.id}
              prompt={prompt}
              onEdit={openEditModal}
              onToggleStatus={handleToggleStatus}
              onDelete={handleDeletePrompt}
              getCategoryColor={getCategoryColor}
              getCategoryGradient={getCategoryGradient}
            />
          ))}
        </div>

        {filteredPrompts.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-400 mb-4">
              <Search className="w-12 h-12 mx-auto mb-4" />
              <p>No prompts found matching your criteria</p>
            </div>
          </div>
        )}
      </div>

      {/* Create/Edit Modal */}
      <PromptModal
        isOpen={showCreateModal || showEditModal}
        isEditMode={showEditModal}
        formData={formData}
        submitting={submitting}
        categories={categories}
        onClose={handleCloseModal}
        onSubmit={showCreateModal ? handleCreatePrompt : handleEditPrompt}
        onInputChange={handleInputChange}
      />
    </div>
  );
};

export default AdminDashboard;