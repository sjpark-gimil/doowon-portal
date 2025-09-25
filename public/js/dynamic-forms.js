/**
 * Dynamic Forms Handler for Doowon Portal
 * Handles dynamic field rendering and validation based on field configurations
 */

class DynamicFormHandler {
    constructor() {
        this.fieldConfigs = {};
        this.currentSection = null;
        this.formData = {};
    }

    /**
     * Load field configurations for a specific section
     * @param {string} section - The section name (e.g., 'weekly-reports', 'hardware-management')
     */
    async loadFieldConfigs(section) {
        try {
            const response = await fetch(`/api/field-configs/${section}`);
            const data = await response.json();
            
            if (data.success) {
                this.fieldConfigs[section] = data.fieldConfigs;
                this.currentSection = section;
                return data.fieldConfigs;
            } else {
                console.error('Failed to load field configs:', data.error);
                return [];
            }
        } catch (error) {
            console.error('Error loading field configs:', error);
            return [];
        }
    }

    /**
     * Render dynamic form fields based on configuration
     * @param {string} containerId - The ID of the container element
     * @param {string} section - The section name
     * @param {Object} initialData - Initial form data (optional)
     */
    async renderForm(containerId, section, initialData = {}) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }

        const fieldConfigs = await this.loadFieldConfigs(section);
        if (!fieldConfigs || fieldConfigs.length === 0) {
            container.innerHTML = '<div class="empty-state"><i>📝</i><p>등록된 필드가 없습니다.</p></div>';
            return;
        }

        this.formData = { ...initialData };
        container.innerHTML = '';

        // Group fields by category
        const fieldGroups = this.groupFieldsByCategory(fieldConfigs);

        Object.keys(fieldGroups).forEach(groupName => {
            const groupElement = this.createFieldGroup(groupName, fieldGroups[groupName]);
            container.appendChild(groupElement);
        });
    }

    /**
     * Group fields by category for better organization
     * @param {Array} fieldConfigs - Array of field configurations
     */
    groupFieldsByCategory(fieldConfigs) {
        const groups = {
            '필수 항목': [],
            '선택 항목': []
        };

        fieldConfigs.forEach((field) => {
            if (field.required) {
                groups['필수 항목'].push(field);
            } else {
                groups['선택 항목'].push(field);
            }
        });

        // Remove empty groups
        Object.keys(groups).forEach(key => {
            if (groups[key].length === 0) {
                delete groups[key];
            }
        });

        return groups;
    }

    /**
     * Create a field group element
     * @param {string} groupName - Name of the field group
     * @param {Array} fields - Array of field configurations
     */
    createFieldGroup(groupName, fields) {
        const groupElement = document.createElement('div');
        groupElement.className = 'field-group';
        groupElement.innerHTML = `<h4>${groupName}</h4>`;

        fields.forEach(field => {
            const fieldElement = this.createFieldElement(field);
            groupElement.appendChild(fieldElement);
        });

        return groupElement;
    }

    /**
     * Create a single field element
     * @param {Object} field - Field configuration
     */
    createFieldElement(field) {
        const fieldElement = document.createElement('div');
        fieldElement.className = 'field-item';
        fieldElement.dataset.fieldId = field.id;
        fieldElement.dataset.fieldType = field.type;

        const label = document.createElement('span');
        label.className = 'field-label';
        label.textContent = field.name + (field.required ? ' *' : '');
        fieldElement.appendChild(label);

        const inputElement = this.createInputElement(field);
        fieldElement.appendChild(inputElement);

        return fieldElement;
    }

    /**
     * Create input element based on field type
     * @param {Object} field - Field configuration
     */
    createInputElement(field) {
        const inputContainer = document.createElement('div');
        inputContainer.className = 'field-input-container';

        let inputElement;

        switch (field.type) {
            case 'string':
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                inputElement.placeholder = `${field.name}을(를) 입력하세요`;
                break;

            case 'number':
                inputElement = document.createElement('input');
                inputElement.type = 'number';
                inputElement.placeholder = `${field.name}을(를) 입력하세요`;
                break;

            case 'calendar':
                inputElement = document.createElement('input');
                inputElement.type = 'date';
                break;

            case 'selector':
                inputElement = document.createElement('select');
                const defaultOption = document.createElement('option');
                defaultOption.value = '';
                defaultOption.textContent = '선택하세요';
                inputElement.appendChild(defaultOption);

                if (field.options && field.options.length > 0) {
                    field.options.forEach(option => {
                        const optionElement = document.createElement('option');
                        optionElement.value = option;
                        optionElement.textContent = option;
                        inputElement.appendChild(optionElement);
                    });
                }
                break;

            case 'attachment':
                inputElement = document.createElement('input');
                inputElement.type = 'file';
                inputElement.multiple = true;
                inputElement.accept = '.pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif';
                break;

            default:
                inputElement = document.createElement('input');
                inputElement.type = 'text';
                break;
        }

        // Set common attributes
        inputElement.name = field.codebeamerId;
        inputElement.id = `field_${field.id}`;
        inputElement.className = 'field-input';
        
        if (field.required) {
            inputElement.required = true;
        }
        
        if (field.readonly) {
            inputElement.readOnly = true;
            inputElement.classList.add('readonly');
        }

        // Set initial value if available
        if (this.formData[field.codebeamerId]) {
            inputElement.value = this.formData[field.codebeamerId];
        }

        // Add event listener for data collection
        inputElement.addEventListener('input', (e) => {
            this.updateFormData(field.codebeamerId, e.target.value);
        });

        inputContainer.appendChild(inputElement);
        return inputContainer;
    }

    /**
     * Update form data
     * @param {string} fieldName - Field name
     * @param {any} value - Field value
     */
    updateFormData(fieldName, value) {
        this.formData[fieldName] = value;
    }

    /**
     * Get current form data
     */
    getFormData() {
        return { ...this.formData };
    }

    /**
     * Validate form data
     */
    validateForm() {
        const errors = [];
        const fieldConfigs = this.fieldConfigs[this.currentSection] || [];

        fieldConfigs.forEach(field => {
            const value = this.formData[field.codebeamerId];
            
            if (field.required && (!value || value.toString().trim() === '')) {
                errors.push(`${field.name}은(는) 필수 입력 항목입니다.`);
            }

            if (field.type === 'number' && value && isNaN(Number(value))) {
                errors.push(`${field.name}은(는) 숫자여야 합니다.`);
            }

            if (field.type === 'calendar' && value) {
                const date = new Date(value);
                if (isNaN(date.getTime())) {
                    errors.push(`${field.name}은(는) 유효한 날짜여야 합니다.`);
                }
            }
        });

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Clear form data
     */
    clearForm() {
        this.formData = {};
        const inputs = document.querySelectorAll('.field-input');
        inputs.forEach(input => {
            input.value = '';
        });
    }

    /**
     * Set form data
     * @param {Object} data - Form data to set
     */
    setFormData(data) {
        this.formData = { ...data };
        Object.keys(data).forEach(fieldName => {
            const input = document.querySelector(`[name="${fieldName}"]`);
            if (input) {
                input.value = data[fieldName];
            }
        });
    }

    /**
     * Get field configuration for a specific section
     * @param {string} section - Section name
     */
    getFieldConfigs(section) {
        return this.fieldConfigs[section] || [];
    }

    /**
     * Create a dynamic table for listing items
     * @param {string} containerId - Container element ID
     * @param {Array} items - Array of items to display
     * @param {string} section - Section name for field configuration
     */
    async renderTable(containerId, items, section) {
        const container = document.getElementById(containerId);
        if (!container) {
            console.error(`Container with ID '${containerId}' not found`);
            return;
        }

        const fieldConfigs = await this.loadFieldConfigs(section);
        if (!fieldConfigs || fieldConfigs.length === 0) {
            container.innerHTML = '<div class="empty-state"><i>📝</i><p>등록된 필드가 없습니다.</p></div>';
            return;
        }

        // Create table
        const table = document.createElement('table');
        table.className = 'dynamic-table';

        // Create header
        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        
        // Add ID column
        const idHeader = document.createElement('th');
        idHeader.textContent = 'ID';
        headerRow.appendChild(idHeader);

        // Add field columns
        fieldConfigs.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field.name;
            headerRow.appendChild(th);
        });

        // Add actions column
        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = '작업';
        headerRow.appendChild(actionsHeader);

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // Create body
        const tbody = document.createElement('tbody');
        
        if (items.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = fieldConfigs.length + 2;
            emptyCell.textContent = '데이터가 없습니다.';
            emptyCell.className = 'empty-cell';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            items.forEach(item => {
                const row = document.createElement('tr');
                row.dataset.itemId = item.id;

                // Add ID cell
                const idCell = document.createElement('td');
                idCell.textContent = item.id;
                row.appendChild(idCell);

                // Add field cells
                fieldConfigs.forEach(field => {
                    const cell = document.createElement('td');
                    const value = item[field.codebeamerId] || '';
                    cell.textContent = value;
                    row.appendChild(cell);
                });

                // Add actions cell
                const actionsCell = document.createElement('td');
                actionsCell.innerHTML = `
                    <button class="btn-small btn-info" onclick="editItem(${item.id})">수정</button>
                    <button class="btn-small btn-danger" onclick="deleteItem(${item.id})">삭제</button>
                `;
                row.appendChild(actionsCell);

                tbody.appendChild(row);
            });
        }

        table.appendChild(tbody);
        container.innerHTML = '';
        container.appendChild(table);
    }
}

// Global instance
window.dynamicFormHandler = new DynamicFormHandler();

// Utility functions for global access
window.loadDynamicForm = async function(containerId, section, initialData = {}) {
    return await window.dynamicFormHandler.renderForm(containerId, section, initialData);
};

window.loadDynamicTable = async function(containerId, items, section) {
    return await window.dynamicFormHandler.renderTable(containerId, items, section);
};

window.getFormData = function() {
    return window.dynamicFormHandler.getFormData();
};

window.validateForm = function() {
    return window.dynamicFormHandler.validateForm();
};

window.clearForm = function() {
    window.dynamicFormHandler.clearForm();
};

window.setFormData = function(data) {
    window.dynamicFormHandler.setFormData(data);
};
