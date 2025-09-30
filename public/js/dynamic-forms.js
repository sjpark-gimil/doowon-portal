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

        if (this.formData[field.codebeamerId]) {
            inputElement.value = this.formData[field.codebeamerId];
        }

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
    transformFormDataForCodeBeamer(formData, section, trackerId) {
        const fieldConfigs = this.getFieldConfigs(section);
        const transformedData = {
            name: formData.name || formData.title || 'Untitled Item',
            description: formData.description || '',
            descriptionFormat: 'PlainText'
        };

        // Map custom fields
        const customFields = {};
        fieldConfigs.forEach(field => {
            const value = formData[field.codebeamerId];
            if (value !== undefined && value !== null && value !== '') {
                // Handle different field types
                if (field.type === 'number' && !isNaN(Number(value))) {
                    customFields[field.id] = Number(value);
                } else if (field.type === 'calendar' && value) {
                    // Convert date to ISO format if needed
                    customFields[field.id] = new Date(value).toISOString().split('T')[0];
                } else {
                    customFields[field.id] = value;
                }
            }
        });

        if (Object.keys(customFields).length > 0) {
            transformedData.customFields = Object.keys(customFields).map(fieldId => ({
                fieldId: parseInt(fieldId),
                value: customFields[fieldId]
            }));
        }

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

        // Store items for pagination
        this.allItems = items;
        this.filteredItems = [...items];
        this.currentSection = section;

        // Update pagination info
        this.pagination.totalItems = this.filteredItems.length;
        this.pagination.totalPages = Math.ceil(this.filteredItems.length / this.pagination.itemsPerPage);
        this.pagination.currentPage = Math.min(this.pagination.currentPage, this.pagination.totalPages || 1);

        // Clear container
        container.innerHTML = '';

        // Create table wrapper
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        // Create table
        const table = this.createTable(fieldConfigs, options);
        tableWrapper.appendChild(table);

        // Create pagination controls (bottom only)
        if (options.pagination !== false && this.filteredItems.length > 0) {
            const bottomPagination = this.createPaginationControls('bottom', fieldConfigs);
            tableWrapper.appendChild(bottomPagination);
        }

        container.appendChild(tableWrapper);
    }

    /**
     * Create the actual table element
     */
    createTable(fieldConfigs, options) {
        const table = document.createElement('table');
        table.className = 'dynamic-table';

        // Create header
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

        // Create body with pagination
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
                    const value = item[field.codebeamerId] || '';
                    cell.textContent = value;
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

    /**
     * Create pagination controls
     */
    createPaginationControls(position, fieldConfigs) {
        const paginationDiv = document.createElement('div');
        paginationDiv.className = `pagination pagination-${position}`;
        paginationDiv.id = `pagination-${position}`;

        // Items per page selector
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
        
        // Add event listener after creating the element
        const selectElement = itemsPerPageDiv.querySelector(`#itemsPerPage-${position}`);
        selectElement.addEventListener('change', (e) => {
            console.log('Items per page changed to:', e.target.value);
            this.changeItemsPerPage(e.target.value);
        });

        // Navigation buttons
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

        // Page numbers
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

        // Page info
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

    /**
     * Change page
     */
    changePage(direction) {
        const newPage = this.pagination.currentPage + direction;
        if (newPage >= 1 && newPage <= this.pagination.totalPages) {
            this.pagination.currentPage = newPage;
            this.refreshTable();
        }
    }

    /**
     * Go to specific page
     */
    goToPage(page) {
        if (page >= 1 && page <= this.pagination.totalPages) {
            this.pagination.currentPage = page;
            this.refreshTable();
        }
    }

    /**
     * Change items per page
     */
    changeItemsPerPage(newItemsPerPage) {
        this.pagination.itemsPerPage = parseInt(newItemsPerPage);
        this.pagination.currentPage = 1;
        this.pagination.totalPages = Math.ceil(this.filteredItems.length / this.pagination.itemsPerPage);
        this.refreshTable();
    }

    /**
     * Refresh table display
     */
    async refreshTable() {
        if (this.currentSection) {
            const containerId = this.getTableContainerId();
            if (containerId) {
                await this.renderTable(containerId, this.allItems, this.currentSection);
            }
        }
    }

    /**
     * Get table container ID (this is a placeholder - should be overridden by the calling page)
     */
    getTableContainerId() {
        // This should be overridden by the calling page
        return null;
    }

    /**
     * Filter items based on search criteria
     */
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

// Global pagination functions
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
