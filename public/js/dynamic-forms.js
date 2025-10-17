class DynamicFormHandler {
    constructor() {
        this.fieldConfigs = {};
        this.currentSection = null;
        this.formData = {};
        this.pagination = {
            currentPage: 1,
            itemsPerPage: 25,
            totalItems: 0,
            totalPages: 0
        };
        this.allItems = [];
        this.filteredItems = [];
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

            case 'textarea':
                inputElement = document.createElement('textarea');
                inputElement.placeholder = `${field.name}을(를) 입력하세요`;
                inputElement.rows = 4;
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

        if (this.formData[field.codebeamerId]) {
            inputElement.value = this.formData[field.codebeamerId];
        }

        inputElement.addEventListener('input', (e) => {
            this.updateFormData(field.codebeamerId, e.target.value);
        });
        
        inputElement.addEventListener('change', (e) => {
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

    getFormData() {
        return { ...this.formData };
    }
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
     * Transform form data to CodeBeamer API format
     * @param {Object} formData - Form data from the form
     * @param {string} section - Section name for field configuration
     * @param {string} trackerId - Tracker ID for the item
     */
    async transformFormDataForCodeBeamer(formData, section, trackerId) {
        let fieldConfigs = this.getFieldConfigs(section);
        
        if (!fieldConfigs || fieldConfigs.length === 0) {
            console.warn('[Transform] Field configs not loaded, loading now...');
            fieldConfigs = await this.loadFieldConfigs(section);
        }
        
        console.log('[Transform] Input formData:', formData);
        console.log('[Transform] Field configs:', fieldConfigs);
        
        let itemName = formData.name || formData.title || '';
        if (!itemName) {
            const today = new Date().toISOString().split('T')[0];
            itemName = `${section} - ${today}`;
        }
        
        let descriptionValue = formData.description || '';
        if (!descriptionValue || descriptionValue.trim() === '') {
            const firstFieldValue = Object.values(formData).find(val => val && val.toString().trim() !== '');
            descriptionValue = firstFieldValue ? `Entry created: ${firstFieldValue}` : 'Auto-generated entry';
        }
        
        const transformedData = {
            name: itemName,
            description: descriptionValue,
            customFields: []
        };

        fieldConfigs.forEach(field => {
            const value = formData[field.codebeamerId];
            console.log(`[Transform] Field: ${field.name}, required: ${field.required}, codebeamerId: ${field.codebeamerId}, value: ${value}, referenceId: ${field.referenceId}`);
            
            if (field.codebeamerId === 'description') {
                if (value && (!descriptionValue || descriptionValue === 'Auto-generated entry')) {
                    descriptionValue = value;
                    console.log(`[Transform] Using field "${field.name}" as description`);
                }
                return;
            }
            
            if (value !== undefined && value !== null && value !== '') {
                const referenceId = field.referenceId || field.id;
                console.log(`  ✓ Adding field to customFields: ${field.name}`);
                
                if (field.type === 'number' && !isNaN(Number(value))) {
                    transformedData.customFields.push({
                        fieldId: parseInt(referenceId),
                        value: Number(value),
                        type: "IntegerFieldValue"
                    });
                } else if (field.type === 'calendar' && value) {
                    let dateValue;
                    try {
                        const date = new Date(value);
                        if (isNaN(date.getTime())) {
                            console.warn(`Invalid date for field ${field.name}: ${value}`);
                            return;
                        }
                        dateValue = date.toISOString();
                    } catch (e) {
                        console.warn(`Error parsing date for field ${field.name}: ${value}`, e);
                        return;
                    }
                    
                    transformedData.customFields.push({
                        fieldId: parseInt(referenceId),
                        value: dateValue,
                        type: "DateFieldValue"
                    });
                } else if (field.type === 'selector' && value) {
                    transformedData.customFields.push({
                        fieldId: parseInt(referenceId),
                        value: value,
                        type: "TextFieldValue"
                    });
                } else {
                    transformedData.customFields.push({
                        fieldId: parseInt(referenceId),
                        value: value,
                        type: "TextFieldValue"
                    });
                }
            } else {
                console.log(`  ✗ Skipping field (no value): ${field.name}, required: ${field.required}`);
            }
        });
        
        transformedData.description = descriptionValue;

        console.log('[Transform] Output transformed data:', JSON.stringify(transformedData, null, 2));
        console.log('[Transform] Summary - name:', transformedData.name, ', description:', transformedData.description, ', customFields count:', transformedData.customFields.length);
        return transformedData;
    }

    /**
     * Create a dynamic table for listing items with pagination
     * @param {string} containerId - Container element ID
     * @param {Array} items - Array of items to display
     * @param {string} section - Section name for field configuration
     * @param {Object} options - Options for table rendering (pagination, search, etc.)
     */
    async renderTable(containerId, items, section, options = {}) {
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

        this.allItems = items;
        this.filteredItems = [...items];
        this.currentSection = section;
        this.pagination.totalItems = this.filteredItems.length;
        this.pagination.totalPages = Math.ceil(this.filteredItems.length / this.pagination.itemsPerPage);
        this.pagination.currentPage = Math.min(this.pagination.currentPage, this.pagination.totalPages || 1);

        container.innerHTML = '';
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const table = this.createTable(fieldConfigs, options);
        tableWrapper.appendChild(table);

        if (options.pagination !== false && this.filteredItems.length > 0) {
            const bottomPagination = this.createPaginationControls('bottom', fieldConfigs);
            tableWrapper.appendChild(bottomPagination);
        }

        container.appendChild(tableWrapper);
    }


    createTable(fieldConfigs, options) {
        const table = document.createElement('table');
        table.className = 'dynamic-table';

        const thead = document.createElement('thead');
        const headerRow = document.createElement('tr');
        const idHeader = document.createElement('th');
        idHeader.textContent = 'ID';
        headerRow.appendChild(idHeader);
        
        fieldConfigs.forEach(field => {
            const th = document.createElement('th');
            th.textContent = field.name;
            headerRow.appendChild(th);
        });

        const actionsHeader = document.createElement('th');
        actionsHeader.textContent = '작업';
        headerRow.appendChild(actionsHeader);
        thead.appendChild(headerRow);
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        
        if (this.filteredItems.length === 0) {
            const emptyRow = document.createElement('tr');
            const emptyCell = document.createElement('td');
            emptyCell.colSpan = fieldConfigs.length + 2;
            emptyCell.textContent = '데이터가 없습니다.';
            emptyCell.className = 'empty-cell';
            emptyRow.appendChild(emptyCell);
            tbody.appendChild(emptyRow);
        } else {
            const startIndex = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage;
            const endIndex = startIndex + this.pagination.itemsPerPage;
            const pageItems = this.filteredItems.slice(startIndex, endIndex);

            pageItems.forEach(item => {
                const row = document.createElement('tr');
                row.dataset.itemId = item.id;

                const idCell = document.createElement('td');
                idCell.textContent = item.id;
                row.appendChild(idCell);

                fieldConfigs.forEach(field => {
                    const cell = document.createElement('td');
                    const value = this.getFieldValue(item, field);
                    
                    if (field.type === 'string' || field.type === 'textarea') {
                        if (value && value.length > 50) {
                            cell.innerHTML = `<span title="${value.replace(/"/g, '&quot;')}">${value.substring(0, 50)}...</span>`;
                        } else {
                            cell.textContent = value;
                        }
                        cell.className = 'text-field-cell';
                    } else {
                        cell.textContent = value;
                    }
                    
                    row.appendChild(cell);
                });

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
        return table;
    }

    createPaginationControls(position, fieldConfigs) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = `pagination pagination-${position}`;
        paginationDiv.id = `pagination-${position}`;

        const itemsPerPageDiv = document.createElement('div');
        itemsPerPageDiv.className = 'pagination-controls';
        itemsPerPageDiv.innerHTML = `
            <label for="itemsPerPage-${position}">페이지 당 아이템:</label>
            <select id="itemsPerPage-${position}">
                <option value="10" ${this.pagination.itemsPerPage === 10 ? 'selected' : ''}>10</option>
                <option value="25" ${this.pagination.itemsPerPage === 25 ? 'selected' : ''}>25</option>
                <option value="50" ${this.pagination.itemsPerPage === 50 ? 'selected' : ''}>50</option>
                <option value="100" ${this.pagination.itemsPerPage === 100 ? 'selected' : ''}>100</option>
            </select>
        `;

        const selectElement = itemsPerPageDiv.querySelector(`#itemsPerPage-${position}`);
        selectElement.addEventListener('change', (e) => {
            console.log('Items per page changed to:', e.target.value);
            this.changeItemsPerPage(e.target.value);
        });

        const navDiv = document.createElement('div');
        navDiv.className = 'pagination-nav';
        
        const prevButton = document.createElement('button');
        prevButton.textContent = '이전';
        prevButton.disabled = this.pagination.currentPage === 1;
        prevButton.addEventListener('click', () => {
            console.log('Previous page clicked');
            this.changePage(-1);
        });

        const nextButton = document.createElement('button');
        nextButton.textContent = '다음';
        nextButton.disabled = this.pagination.currentPage === this.pagination.totalPages;
        nextButton.addEventListener('click', () => {
            console.log('Next page clicked');
            this.changePage(1);
        });


        const pageNumbersDiv = document.createElement('div');
        pageNumbersDiv.className = 'page-numbers';
        
        const startPage = Math.max(1, this.pagination.currentPage - 2);
        const endPage = Math.min(this.pagination.totalPages, this.pagination.currentPage + 2);

        for (let i = startPage; i <= endPage; i++) {
            const pageButton = document.createElement('button');
            pageButton.textContent = i;
            pageButton.className = i === this.pagination.currentPage ? 'page-btn active' : 'page-btn';
            pageButton.addEventListener('click', () => {
                console.log('Page clicked:', i);
                this.goToPage(i);
            });
            pageNumbersDiv.appendChild(pageButton);
        }

        const pageInfo = document.createElement('div');
        pageInfo.className = 'pagination-info';
        const startItem = (this.pagination.currentPage - 1) * this.pagination.itemsPerPage + 1;
        const endItem = Math.min(this.pagination.currentPage * this.pagination.itemsPerPage, this.pagination.totalItems);
        pageInfo.textContent = `${startItem}-${endItem} / 총 ${this.pagination.totalItems}개`;

        navDiv.appendChild(prevButton);
        navDiv.appendChild(pageNumbersDiv);
        navDiv.appendChild(nextButton);

        paginationDiv.appendChild(itemsPerPageDiv);
        paginationDiv.appendChild(navDiv);
        paginationDiv.appendChild(pageInfo);

        return paginationDiv;
    }


    changePage(direction) {
        const newPage = this.pagination.currentPage + direction;
        if (newPage >= 1 && newPage <= this.pagination.totalPages) {
            this.pagination.currentPage = newPage;
            this.refreshTable();
        }
    }

    goToPage(page) {
        if (page >= 1 && page <= this.pagination.totalPages) {
            this.pagination.currentPage = page;
            this.refreshTable();
        }
    }


    changeItemsPerPage(newItemsPerPage) {
        this.pagination.itemsPerPage = parseInt(newItemsPerPage);
        this.pagination.currentPage = 1;
        this.pagination.totalPages = Math.ceil(this.filteredItems.length / this.pagination.itemsPerPage);
        this.refreshTable();
    }

    async refreshTable() {
        if (this.currentSection) {
            const containerId = this.getTableContainerId();
            if (containerId) {
                await this.renderTable(containerId, this.allItems, this.currentSection);
            }
        }
    }


    getTableContainerId() {
        return null;
    }

    /**
     * Extract field value from item data
     * @param {Object} item - The item data
     * @param {Object} field - The field configuration
     */
    getFieldValue(item, field) {
        if (field.codebeamerId === 'name') return item.name || '';
        if (field.codebeamerId === 'status') return item.status?.name || item.status || '';

        console.log(`Getting field value for ${field.name} (${field.codebeamerId}), referenceId: ${field.referenceId}`);
        console.log('Item customFields:', item.customFields);
        
        if (item.customFields && Array.isArray(item.customFields)) {
            const customField = item.customFields.find(cf => 
                cf.fieldId == field.referenceId || 
                cf.id == field.referenceId ||
                cf.referenceId == field.referenceId
            );
            
            console.log(`Found custom field for ${field.name}:`, customField);
            
            if (customField) {
                let value = '';
                if (typeof customField.value === 'string') {
                    value = customField.value;
                } else if (customField.value && customField.value.name) {
                    value = customField.value.name;
                } else if (Array.isArray(customField.values) && customField.values.length > 0) {
                    value = customField.values[0].name || customField.values[0];
                } else if (customField.value && typeof customField.value === 'object') {
                    value = JSON.stringify(customField.value);
                } else {
                    value = customField.value || '';
                }
                
                if (field.type === 'calendar' && value) {
                    try {
                        const date = new Date(value);
                        if (!isNaN(date.getTime())) {
                            return date.toLocaleDateString('ko-KR', {
                                year: 'numeric',
                                month: '2-digit',
                                day: '2-digit'
                            });
                        }
                    } catch (e) {
                        console.log('Date parsing error:', e);
                    }
                }
                
                console.log(`Returning value: ${value}`);
                return value;
            } else {
                console.log(`No custom field found for ${field.name} with referenceId ${field.referenceId}`);
            }
        } else {
            console.log('No customFields array found in item');
        }

        const fieldKey = `custom_field_${field.referenceId}`;
        if (item[fieldKey]) {
            let value = '';
            if (typeof item[fieldKey] === 'string') {
                value = item[fieldKey];
            } else if (item[fieldKey].name) {
                value = item[fieldKey].name;
            } else if (Array.isArray(item[fieldKey])) {
                value = item[fieldKey][0]?.name || item[fieldKey][0];
            }
            
            if (field.type === 'calendar' && value) {
                try {
                    const date = new Date(value);
                    if (!isNaN(date.getTime())) {
                        return date.toLocaleDateString('ko-KR', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit'
                        });
                    }
                } catch (e) {
                    console.log('Date parsing error:', e);
                }
            }
            
            return value;
        }
        
        return '';
    }


    filterItems(searchTerm, fieldConfigs) {
        if (!searchTerm || searchTerm.trim() === '') {
            this.filteredItems = [...this.allItems];
        } else {
            const term = searchTerm.toLowerCase();
            this.filteredItems = this.allItems.filter(item => {
                return fieldConfigs.some(field => {
                    const value = item[field.codebeamerId] || '';
                    return value.toString().toLowerCase().includes(term);
                }) || item.id.toString().includes(term);
            });
        }
        this.pagination.currentPage = 1;
        this.pagination.totalItems = this.filteredItems.length;
        this.pagination.totalPages = Math.ceil(this.filteredItems.length / this.pagination.itemsPerPage);
        this.refreshTable();
    }
}

window.dynamicFormHandler = new DynamicFormHandler();
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

window.changeItemsPerPage = function(newItemsPerPage, section) {
    window.dynamicFormHandler.changeItemsPerPage(newItemsPerPage);
};

window.changePage = function(direction) {
    window.dynamicFormHandler.changePage(direction);
};

window.goToPage = function(page) {
    window.dynamicFormHandler.goToPage(page);
};

window.filterTable = function(searchTerm) {
    if (window.dynamicFormHandler.currentSection) {
        window.dynamicFormHandler.loadFieldConfigs(window.dynamicFormHandler.currentSection)
            .then(fieldConfigs => {
                window.dynamicFormHandler.filterItems(searchTerm, fieldConfigs);
            });
    }
};

window.transformFormDataForCodeBeamer = function(formData, section, trackerId) {
    return window.dynamicFormHandler.transformFormDataForCodeBeamer(formData, section, trackerId);
};
