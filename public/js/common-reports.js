class ReportManager {
    constructor(config) {
        this.sectionName = config.sectionName;
        this.displayName = config.displayName;
        this.attachmentInputId = config.attachmentInputId || 'reportAttachments';
        this.allReports = [];
        this.filteredReports = [];
        this.currentPage = 1;
        this.pageSize = 25;
        this.totalPages = 1;
        this.searchQuery = '';
        this.fieldConfigs = [];
        this.currentFilters = {};
        this.isSubmitting = false;
        this.searchOptions = {
            caseSensitive: false,
            wholeWord: false,
            regex: false
        };
        this.currentResultIndex = 0;
        this.searchResults = [];
        this.formHandler = null;
    }
    
    setFormHandler(handler) {
        this.formHandler = handler;
    }
    
    async init() {
        await this.loadReportsWithFilters();
    }
    
    async showCreateForm() {
        window.editingItemId = null;
        window.editingItemData = null;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'reportFormModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>새 ${this.displayName} 추가</h3>
                    <button class="modal-close" onclick="reportManager.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="dynamic-form-container">
                        <div id="dynamicForm" class="loading">
                            <i>⏳</i>
                            <p>필드 구성을 불러오는 중...</p>
                        </div>
                        
                        <div id="validationErrors" class="validation-errors">
                            <h5>입력 오류:</h5>
                            <ul id="errorList"></ul>
                        </div>
                        
                        <!-- Attachment Field -->
                        <div class="field-group">
                            <h4>첨부 파일</h4>
                            <div class="field-item">
                                <span class="field-label">파일 업로드</span>
                                <div class="field-input-container">
                                    <input type="file" id="${this.attachmentInputId}" name="attachments" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" class="field-input">
                                    <small class="field-help">PDF, DOC, XLS, 이미지 파일을 업로드할 수 있습니다.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="reportManager.submitForm()">저장</button>
                    <button type="button" class="btn-secondary" onclick="reportManager.closeModal()">취소</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        await this.loadDynamicForm();
  
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    async showEditForm(itemData) {
        window.editingItemId = itemData.id;
        window.editingItemData = itemData;
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.id = 'reportFormModal';
        modal.innerHTML = `
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${this.displayName} 수정 #${itemData.id}</h3>
                    <button class="modal-close" onclick="reportManager.closeModal()">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="dynamic-form-container">
                        <div id="dynamicForm" class="loading">
                            <i>⏳</i>
                            <p>필드 구성을 불러오는 중...</p>
                        </div>
                        
                        <div id="validationErrors" class="validation-errors">
                            <h5>입력 오류:</h5>
                            <ul id="errorList"></ul>
                        </div>
                        
                        <!-- Attachment Field -->
                        <div class="field-group">
                            <h4>첨부 파일</h4>
                            <div id="existingAttachments" class="existing-attachments" style="display: none;">
                                <h5>기존 첨부 파일:</h5>
                                <ul id="existingFilesList"></ul>
                            </div>
                            <div class="field-item">
                                <span class="field-label">새 파일 추가</span>
                                <div class="field-input-container">
                                    <input type="file" id="${this.attachmentInputId}" name="attachments" multiple accept=".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.gif" class="field-input">
                                    <small class="field-help">PDF, DOC, XLS, 이미지 파일을 업로드할 수 있습니다.</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button type="button" class="btn-primary" onclick="reportManager.submitForm()">저장</button>
                    <button type="button" class="btn-secondary" onclick="reportManager.closeModal()">취소</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        await this.loadDynamicForm();
        await this.populateEditForm(itemData);
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeModal();
            }
        });
    }
    
    closeModal() {
        const modal = document.getElementById('reportFormModal');
        if (modal) {
            try {
                this.hideValidationErrors();
                if (this.formHandler) {
                    this.formHandler.clearForm();
                }
            } catch (e) {
                console.log('Error during cleanup:', e);
            }
            modal.remove();
        }
    }
    
    async loadDynamicForm() {
        try {
            if (!this.formHandler) {
                throw new Error('Form handler not set');
            }
            await this.formHandler.renderForm('dynamicForm', this.sectionName);
            console.log('Dynamic form loaded successfully');
        } catch (error) {
            console.error('Error loading dynamic form:', error);
            document.getElementById('dynamicForm').innerHTML = 
                '<div class="empty-state"><i>❌</i><p>필드 구성을 불러올 수 없습니다.</p></div>';
        }
    }
    
    async submitForm() {
        if (this.isSubmitting) {
            console.log('⚠️ Already submitting, ignoring duplicate call');
            return;
        }
        
        const validation = this.formHandler.validateForm();
        
        if (!validation.isValid) {
            this.showValidationErrors(validation.errors);
            return;
        }

        const formData = this.formHandler.getFormData();
        console.log(`Submitting ${this.displayName} form data:`, formData);
        
        this.isSubmitting = true;
        
        try {
            if (window.editingItemId) {
                await this.updateExistingItem(window.editingItemId, formData);
                
                const fileInput = document.getElementById(this.attachmentInputId);
                if (fileInput && fileInput.files.length > 0) {
                    await this.uploadAttachments(window.editingItemId, fileInput.files);
                }
            } else {
                await this.createNewItem(formData);
            }
            
            window.editingItemId = null;
            window.editingItemData = null;
            
            this.closeModal();
            this.showLoadingIndicator();
            this.showStatus(`${this.displayName}가 저장되었습니다. 목록을 새로고침하는 중...`, true);
            
            await this.loadReportsWithFilters();
            
            this.hideLoadingIndicator();
            this.showStatus(`${this.displayName}가 성공적으로 저장되었습니다`, true);
            
        } catch (error) {
            console.error('Error submitting form:', error);
            this.showStatus(`${this.displayName} 저장에 실패했습니다: ` + error.message, false);
        } finally {
            this.isSubmitting = false;
        }
    }
    
    async createNewItem(formData) {
        const trackerId = await this.getTrackerIdForSection(this.sectionName);
        if (!trackerId) {
            throw new Error(`${this.displayName} 관리용 트래커가 설정되지 않았습니다. 관리자에게 문의하세요.`);
        }

        const codebeamerData = await transformFormDataForCodeBeamer(formData, this.sectionName, trackerId);
        console.log('Transformed data for CodeBeamer:', codebeamerData);

        const response = await fetch(`/api/v3/trackers/${trackerId}/items`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(codebeamerData)
        });
        
        const data = await response.json();
        
        if (data.success) {
            const itemId = data.item?.id;  
            const fileInput = document.getElementById(this.attachmentInputId);
            if (fileInput && fileInput.files.length > 0 && itemId) {
                await this.uploadAttachments(itemId, fileInput.files);
            }
        } else {
            throw new Error(data.error || 'Failed to create item');
        }
    }
    
    async updateExistingItem(itemId, formData) {
        await this.loadFieldConfigsForSection(this.sectionName);
        const fieldValues = [];
        
        if (this.fieldConfigs && Array.isArray(this.fieldConfigs)) {
            this.fieldConfigs.forEach(field => {
                const value = formData[field.codebeamerId];
                if (value !== undefined && value !== null && value !== '') {
                    const fieldType = this.getFieldValueType(field.type);
                    const actualType = fieldType === 'ChoiceFieldValue' ? 'TextFieldValue' : fieldType;
                    
                    fieldValues.push({
                        fieldId: field.referenceId,
                        type: actualType,
                        name: field.name,
                        value: value
                    });
                }
            });
        } else {
            throw new Error('Field configurations not loaded properly');
        }
        
        if (fieldValues.length === 0) {
            throw new Error('No fields to update');
        }
        
        console.log('Updating item fields:', fieldValues);
        
        const response = await fetch(`/api/codebeamer/items/${itemId}/fields`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ fieldValues })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to update item');
        }
    }
    
    getFieldValueType(fieldType) {
        switch (fieldType) {
            case 'string':
            case 'text':
                return 'TextFieldValue';
            case 'number':
                return 'IntegerFieldValue';
            case 'date':
                return 'DateFieldValue';
            case 'selector':
                return 'ChoiceFieldValue';
            default:
                return 'TextFieldValue';
        }
    }
    
    async uploadAttachments(itemId, files) {
        console.log(`Uploading ${files.length} attachments to item ${itemId}`);
        
        const attachmentFormData = new FormData();
        for (let i = 0; i < files.length; i++) {
            attachmentFormData.append('attachments', files[i]);
        }
        
        try {
            const attachResponse = await fetch(`/api/v3/items/${itemId}/attachments`, {
                method: 'POST',
                body: attachmentFormData
            });
            
            const attachData = await attachResponse.json();
            
            if (attachData.success) {
                console.log(`Successfully uploaded ${attachData.attachments.length} attachments`);
            } else {
                console.warn(`Attachment upload failed: ${attachData.message}`);
            }
        } catch (attachError) {
            console.error('Attachment upload error:', attachError);
        }
    }
    
    async populateEditForm(itemData) {
        try {
            await new Promise(resolve => setTimeout(resolve, 500));     
            await this.loadFieldConfigsForSection(this.sectionName);
            
            console.log('Field configs loaded:', this.fieldConfigs);
            console.log('Item data:', itemData);
            
            if (this.fieldConfigs && Array.isArray(this.fieldConfigs)) {
                this.fieldConfigs.forEach(field => {
                    const fieldValue = this.getReportFieldValue(itemData, field);
                    console.log(`Field ${field.name} (${field.codebeamerId}):`, fieldValue);
                    
                    if (fieldValue !== null && fieldValue !== undefined && fieldValue !== '') {
                        const input = document.querySelector(`[name="${field.codebeamerId}"]`);
                        if (input) {
                            if (input.type === 'checkbox') {
                                input.checked = fieldValue === 'true' || fieldValue === true;
                            } else {
                                input.value = fieldValue;
                            }
                            console.log(`Set input ${field.codebeamerId} to:`, fieldValue);
                        } else {
                            console.warn(`No input found for field: ${field.codebeamerId}`);
                        }
                    }
                });
            } else {
                console.error('Field configs is not an array:', this.fieldConfigs);
            }
            
            window.editingItemId = itemData.id;
            window.editingItemData = itemData;
            
            this.displayExistingAttachments(itemData);        
            this.hideValidationErrors();
            
            if (this.fieldConfigs && Array.isArray(this.fieldConfigs)) {
                this.fieldConfigs.forEach(field => {
                    const input = document.querySelector(`[name="${field.codebeamerId}"]`);
                    if (input) {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    }
                });
            }
            
        } catch (error) {
            console.error('Error populating edit form:', error);
        }
    }
    
    displayExistingAttachments(itemData) {
        try {
            const existingAttachmentsDiv = document.getElementById('existingAttachments');
            const existingFilesList = document.getElementById('existingFilesList');
            
            if (!existingAttachmentsDiv || !existingFilesList) {
                console.log('Existing attachments elements not found');
                return;
            }
            
            if (itemData.comments && Array.isArray(itemData.comments) && itemData.comments.length > 0) {
                existingAttachmentsDiv.style.display = 'block';
                existingFilesList.innerHTML = '';
                
                itemData.comments.forEach(comment => {
                    const li = document.createElement('li');
                    li.innerHTML = `
                        <span class="attachment-item">
                            📎 ${comment.name || 'Attachment'}
                            <small style="color: #666; margin-left: 10px;">(${comment.type || 'File'})</small>
                        </span>
                    `;
                    existingFilesList.appendChild(li);
                });
                
                console.log(`Displaying ${itemData.comments.length} existing attachments`);
            } else {
                existingAttachmentsDiv.style.display = 'none';
                console.log('No existing attachments found');
            }
        } catch (error) {
            console.error('Error displaying existing attachments:', error);
        }
    }
    
    showValidationErrors(errors) {
        const errorContainer = document.getElementById('validationErrors');
        const errorList = document.getElementById('errorList');
        
        errorList.innerHTML = '';
        errors.forEach(error => {
            const li = document.createElement('li');
            li.textContent = error;
            errorList.appendChild(li);
        });
        
        errorContainer.classList.add('show');
    }

    hideValidationErrors() {
        const validationErrors = document.getElementById('validationErrors');
        if (validationErrors) {
            validationErrors.classList.remove('show');
        }
    }
    
    async loadReportsWithFilters() {
        try {
            this.showLoadingIndicator();
            
            const trackerId = await this.getTrackerIdForSection(this.sectionName);
            if (!trackerId) {
                console.log(`No tracker ID configured for ${this.sectionName}`);
                this.hideLoadingIndicator();
                return;
            }

            let response;
            let retryCount = 0;
            const maxRetries = 3;
            
            while (retryCount < maxRetries) {
                try {
                    response = await fetch(`/api/codebeamer/trackers/${trackerId}/items?includeFields=true&pageSize=1000`);
                    if (response.ok) {
                        break;
                    }
                    
                    if (response.status === 500 && retryCount < maxRetries - 1) {
                        console.log(`Server error (500), retrying in ${(retryCount + 1) * 1000}ms...`);
                        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
                        retryCount++;
                        continue;
                    }
                    
                    throw new Error(`Failed to fetch items: ${response.status}`);
                } catch (error) {
                    if (retryCount < maxRetries - 1) {
                        console.log(`Network error, retrying in ${(retryCount + 1) * 1000}ms...`);
                        await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
                        retryCount++;
                        continue;
                    }
                    throw error;
                }
            }

            const data = await response.json();
            this.allReports = data.items || [];
            
            console.log('Loaded reports:', this.allReports.length, 'items');
            
            await this.loadFieldConfigsForSection(this.sectionName);
            this.applyAllFilters();
            this.hideLoadingIndicator();

            this.showStatus(`총 ${this.allReports.length}개의 아이템을 가져왔습니다`, true);
        } catch (error) {
            console.error('Error loading reports:', error);
            this.hideLoadingIndicator();
            
            if (error.message.includes('500')) {
                this.showStatus('서버가 일시적으로 과부하 상태입니다. 잠시 후 새로고침 버튼을 클릭해주세요.', false);
                setTimeout(() => {
                    const statusElement = document.querySelector('.status');
                    if (statusElement) {
                        statusElement.innerHTML += ` <button onclick="reportManager.loadReportsWithFilters()" style="margin-left: 10px; padding: 5px 10px; background: #007bff; color: white; border: none; border-radius: 3px; cursor: pointer;">새로고침</button>`;
                    }
                }, 100);
            } else {
                this.showStatus(`${this.displayName} 목록을 불러오는데 실패했습니다`, false);
            }
        }
    }
    
    async getTrackerIdForSection(section) {
        try {
            const response = await fetch(`/api/tracker-id/${section}`);
            const data = await response.json();
            return data.success ? data.trackerId : null;
        } catch (error) {
            console.error('Error getting tracker ID:', error);
            return null;
        }
    }

    async loadFieldConfigsForSection(section) {
        try {
            const response = await fetch(`/api/field-configs/${section}`);
            if (!response.ok) {
                this.fieldConfigs = [];
                return;
            }
            const data = await response.json();
            if (data.success) {
                this.fieldConfigs = data.fieldConfigs || [];
            } else {
                this.fieldConfigs = [];
            }
        } catch (error) {
            console.error('Error loading field configs:', error);
            this.fieldConfigs = [];
        }
    }
    
    applySearch() {
        const searchInput = document.getElementById('searchFilter');
        this.searchQuery = searchInput.value.trim();      
        this.currentPage = 1;
        this.currentResultIndex = 0;
        this.applyAllFilters();
        this.updateSearchResultsInfo();
    }

    clearSearch() {
        const searchInput = document.getElementById('searchFilter');
        searchInput.value = '';
        this.searchQuery = '';
        
        this.currentPage = 1;
        this.currentResultIndex = 0;
        this.applyAllFilters();
        this.updateSearchResultsInfo();
    }

    applyAllFilters() {
        this.filteredReports = this.allReports.filter(report => {
            if (this.searchQuery) {
                const searchText = this.searchOptions.caseSensitive ? this.searchQuery : this.searchQuery.toLowerCase();
                
                const searchableTexts = [];
                searchableTexts.push(String(report.id));
                searchableTexts.push(String(report.name || ''));
                
                if (report.customFields && Array.isArray(report.customFields)) {
                    report.customFields.forEach(customField => {
                        if (customField.value) {
                            if (typeof customField.value === 'string') {
                                searchableTexts.push(customField.value);
                            } else if (customField.value.name) {
                                searchableTexts.push(customField.value.name);
                            } else if (Array.isArray(customField.values)) {
                                customField.values.forEach(val => {
                                    if (val.name) searchableTexts.push(val.name);
                                    else searchableTexts.push(String(val));
                                });
                            } else {
                                searchableTexts.push(String(customField.value));
                            }
                        }
                    });
                }
                
                const searchableText = this.searchOptions.caseSensitive ? 
                    searchableTexts.join(' ') : 
                    searchableTexts.join(' ').toLowerCase();
                
                let found = false;
                
                if (this.searchOptions.wholeWord) {
                    const words = searchableText.split(/\s+/);
                    found = words.includes(searchText);
                } else if (this.searchOptions.regex) {
                    try {
                        const regex = new RegExp(searchText, this.searchOptions.caseSensitive ? 'g' : 'gi');
                        found = regex.test(searchableText);
                    } catch (e) {
                        found = searchableText.includes(searchText);
                    }
                } else {
                    found = searchableText.includes(searchText);
                }
                
                if (!found) {
                    return false;
                }
            }
            
            return true;
        });

        this.searchResults = this.filteredReports;
        this.currentResultIndex = 0;
        this.totalPages = Math.ceil(this.filteredReports.length / this.pageSize);
        this.currentPage = Math.min(this.currentPage, this.totalPages || 1);      
        this.displayReports();
        this.updatePaginationControls();
        this.updateSearchResultsInfo();
        
        let statusMsg = this.searchQuery ? 
            `검색 결과: ${this.filteredReports.length}개의 ${this.displayName}` : 
            `전체: ${this.filteredReports.length}개의 ${this.displayName}`;
        
        this.showStatus(statusMsg, true);
    }
    
    getReportFieldValue(report, field) {
        if (field.codebeamerId === 'name') return report.name;
        if (field.codebeamerId === 'status') return report.status?.name || report.status;
        
        if (report.customFields && Array.isArray(report.customFields)) {
            const customField = report.customFields.find(cf => 
                cf.fieldId == field.referenceId || 
                cf.id == field.referenceId ||
                cf.referenceId == field.referenceId
            );
            
            if (customField) {
                if (typeof customField.value === 'string') return customField.value;
                if (customField.value && customField.value.name) return customField.value.name;
                if (Array.isArray(customField.values) && customField.values.length > 0) {
                    return customField.values[0].name || customField.values[0];
                }
                if (customField.value && typeof customField.value === 'object') {
                    return JSON.stringify(customField.value);
                }
                return customField.value;
            }
        }
        
        const fieldKey = `custom_field_${field.referenceId}`;
        if (report[fieldKey]) {
            if (typeof report[fieldKey] === 'string') return report[fieldKey];
            if (report[fieldKey].name) return report[fieldKey].name;
            if (Array.isArray(report[fieldKey])) {
                return report[fieldKey][0]?.name || report[fieldKey][0];
            }
        }
        
        return null;
    }
    
    toggleCaseSensitive() {
        this.searchOptions.caseSensitive = !this.searchOptions.caseSensitive;
        const btn = document.getElementById('caseSensitiveBtn');
        btn.classList.toggle('active', this.searchOptions.caseSensitive);
        this.applyAllFilters();
    }

    toggleWholeWord() {
        this.searchOptions.wholeWord = !this.searchOptions.wholeWord;
        const btn = document.getElementById('wholeWordBtn');
        btn.classList.toggle('active', this.searchOptions.wholeWord);
        this.applyAllFilters();
    }

    toggleRegex() {
        this.searchOptions.regex = !this.searchOptions.regex;
        const btn = document.getElementById('regexBtn');
        btn.classList.toggle('active', this.searchOptions.regex);
        this.applyAllFilters();
    }

    updateSearchResultsInfo() {
        const info = document.getElementById('searchResultsInfo');
        if (this.searchResults.length > 0) {
            info.textContent = `${this.currentResultIndex + 1} of ${this.searchResults.length}`;
        } else {
            info.textContent = '0 of 0';
        }
    }

    previousResult() {
        if (this.searchResults.length > 0) {
            this.currentResultIndex = (this.currentResultIndex - 1 + this.searchResults.length) % this.searchResults.length;
            this.updateSearchResultsInfo();
            this.highlightCurrentResult();
        }
    }

    nextResult() {
        if (this.searchResults.length > 0) {
            this.currentResultIndex = (this.currentResultIndex + 1) % this.searchResults.length;
            this.updateSearchResultsInfo();
            this.highlightCurrentResult();
        }
    }

    highlightCurrentResult() {
        document.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight');
        });
        
        if (this.searchResults.length > 0 && this.currentResultIndex < this.searchResults.length) {
            const currentResult = this.searchResults[this.currentResultIndex];
            const tableRows = document.querySelectorAll('tr[data-item-id]');
            tableRows.forEach(row => {
                if (row.dataset.itemId == currentResult.id) {
                    row.classList.add('search-highlight');
                    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            });
        }
    }
    
    displayReports() {
        const reportsList = document.getElementById('reportsList');
        if (!reportsList) {
            console.error('reportsList element not found');
            return;
        }

        console.log('displayReports called with:', this.filteredReports.length, 'filtered reports');

        if (this.filteredReports.length === 0) {
            reportsList.innerHTML = `
                <div class="empty-state">
                    <p>검색 조건에 맞는 ${this.displayName}가 없습니다.</p>
                </div>
            `;
            return;
        }

        const startIndex = (this.currentPage - 1) * this.pageSize;
        const endIndex = startIndex + this.pageSize;
        const pageItems = this.filteredReports.slice(startIndex, endIndex);

        this.formHandler.renderTable('reportsList', pageItems, this.sectionName, { pagination: false });
    }
    
    nextPage() {
        if (this.currentPage < this.totalPages) {
            this.currentPage++;
            this.displayReports();
            this.updatePaginationControls();
        }
    }

    prevPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.displayReports();
            this.updatePaginationControls();
        }
    }

    changePageSize(newPageSize) {
        this.pageSize = parseInt(newPageSize);
        this.currentPage = 1;
        this.totalPages = Math.ceil(this.filteredReports.length / this.pageSize);
        this.displayReports();
        this.updatePaginationControls();
    }

    updatePaginationControls() {
        const paginationControls = document.getElementById('paginationControls');
        const prevBtn = document.getElementById('prevBtn');
        const nextBtn = document.getElementById('nextBtn');
        const pageInfo = document.getElementById('pageInfo');
        const itemCount = document.getElementById('itemCount');

        if (this.filteredReports.length > this.pageSize) {
            paginationControls.style.display = 'flex';
            prevBtn.disabled = this.currentPage <= 1;
            nextBtn.disabled = this.currentPage >= this.totalPages;
            
            const startIndex = (this.currentPage - 1) * this.pageSize + 1;
            const endIndex = Math.min(this.currentPage * this.pageSize, this.filteredReports.length);
            
            pageInfo.textContent = `페이지 ${this.currentPage}`;
            itemCount.textContent = `${startIndex}-${endIndex} / 총 ${this.filteredReports.length}개`;
        } else {
            paginationControls.style.display = 'none';
        }
    }
    
    async editReport(id) {
        try {
            this.showLoadingIndicator();
            this.showStatus(`${this.displayName} ${id}번을 불러오는 중...`, true);
            
            const response = await fetch(`/api/codebeamer/items/${id}`);
            if (!response.ok) {
                throw new Error(`Failed to fetch item: ${response.status}`);
            }
            
            const itemData = await response.json();
            await this.showEditForm(itemData);
            
            this.hideLoadingIndicator();
            this.showStatus(`${this.displayName} ${id}번을 수정합니다`, true);
            
        } catch (error) {
            console.error('Error loading item for edit:', error);
            this.hideLoadingIndicator();
            this.showStatus(`${this.displayName} ${id}번을 불러오는데 실패했습니다`, false);
        }
    }

    deleteReport(id) {
        if (confirm(`정말로 ${this.displayName} ${id}번을 삭제하시겠습니까?`)) {
            this.deleteReportFromServer(id);
        }
    }

    async deleteReportFromServer(id) {
        try {
            this.showLoadingIndicator();
            
            const response = await fetch(`/api/codebeamer/items/${id}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (response.ok) {
                this.showStatus(`${this.displayName} ${id}번이 삭제되었습니다. 목록을 새로고침하는 중...`, true);
                await this.loadReportsWithFilters();
                this.showStatus(`${this.displayName} ${id}번이 성공적으로 삭제되었습니다`, true);
            } else {
                const errorData = await response.json();
                this.showStatus(`삭제 실패: ${errorData.error || 'Unknown error'}`, false);
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            this.showStatus(`삭제 중 오류가 발생했습니다: ${error.message}`, false);
        } finally {
            this.hideLoadingIndicator();
        }
    }
    
    showLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'block';
        }
    }

    hideLoadingIndicator() {
        const loadingIndicator = document.getElementById('loadingIndicator');
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }

    showStatus(message, isSuccess) {
        const statusElement = document.getElementById('status') || this.createStatusElement();
        statusElement.textContent = message;
        statusElement.style.display = 'block';
        statusElement.className = 'status ' + (isSuccess ? 'success' : 'error');

        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 5000);
    }

    createStatusElement() {
        const statusElement = document.createElement('div');
        statusElement.id = 'status';
        statusElement.className = 'status';
        document.querySelector('.main-container').appendChild(statusElement);
        return statusElement;
    }
}

function editItem(id) {
    if (window.reportManager) {
        window.reportManager.editReport(id);
    }
}

function deleteItem(id) {
    if (window.reportManager) {
        window.reportManager.deleteReport(id);
    }
}

