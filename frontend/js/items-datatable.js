/**
 * Items Datatable Initialization
 * Handles the display and management of items in a DataTable
 */

// Configuration
const config = {
    apiBaseUrl: 'http://localhost:3000/api',
    endpoints: {
        items: '/item/admin/all',
        categories: '/category'
    },
    imageBaseUrl: 'http://localhost:3000/uploads/'
};

// State
let itemsTable;
let allItems = [];

// DOM Ready
$(document).ready(function() {
    initializeDataTable();
    setupEventListeners();
    loadCategories();
});

/**
 * Initialize the DataTable
 */
function initializeDataTable() {
    const token = localStorage.getItem('token');
    
    if (!token) {
        window.location.href = 'login.html';
        return;
    }

    itemsTable = $('#itemsTable').DataTable({
        responsive: true,
        processing: true,
        serverSide: false,
        searching: true,
        paging: true,
        pageLength: 10,
        lengthChange: false,
        order: [[0, 'desc']],
        ajax: {
            url: `${config.apiBaseUrl}${config.endpoints.items}`,
            type: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`
            },
            dataSrc: function(json) {
                if (json && json.data) {
                    allItems = json.data;
                    updateAnalytics(allItems);
                    return allItems;
                }
                return [];
            },
            error: function(xhr, error, thrown) {
                console.error('Error loading items:', error);
                Swal.fire({
                    title: 'Error',
                    text: 'Failed to load items. Please try again.',
                    icon: 'error'
                });
            }
        },
        columns: [
            { data: 'item_id' },
            { data: 'item_name' },
            {
                data: 'image',
                render: function(data, type, row) {
                    if (!data) return 'No Image';
                    return `<img src="${config.imageBaseUrl}${data}" 
                            alt="${row.item_name}" 
                            style="width: 50px; height: 50px; object-fit: cover;">`;
                }
            },
            { data: 'description' },
            { 
                data: 'cost_price', 
                render: $.fn.dataTable.render.number(',', '.', 2, '₱') 
            },
            { 
                data: 'sell_price', 
                render: $.fn.dataTable.render.number(',', '.', 2, '₱') 
            },
            { data: 'quantity' },
            { data: 'category_name' },
            {
                data: null,
                orderable: false,
                render: function(data, type, row) {
                    let buttons = `
                        <button class="btn btn-sm btn-primary btn-edit" 
                                onclick="editItem('${row.item_id}')">
                            <i class="fas fa-edit"></i>
                        </button>`;
                    
                    if (row.deleted_at) {
                        buttons += `
                            <button class="btn btn-sm btn-success" 
                                    onclick="restoreItem('${row.item_id}')">
                                <i class="fas fa-undo"></i>
                            </button>`;
                    } else {
                        buttons += `
                            <button class="btn btn-sm btn-danger" 
                                    onclick="deleteItem('${row.item_id}')">
                                <i class="fas fa-trash"></i>
                            </button>`;
                    }
                    
                    return `<div class="btn-group">${buttons}</div>`;
                }
            }
        ],
        initComplete: function() {
            // Initialize tooltips
            $('[data-toggle="tooltip"]').tooltip();
        },
        drawCallback: function() {
            // Reinitialize tooltips after table redraw
            $('[data-toggle="tooltip"]').tooltip();
        }
    });
}

/**
 * Update analytics cards with item statistics
 */
function updateAnalytics(items) {
    if (!items || !items.length) return;

    const totalItems = items.length;
    const totalStock = items.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0);
    const totalValue = items.reduce((sum, item) => {
        return sum + (parseFloat(item.sell_price || 0) * parseInt(item.quantity || 0));
    }, 0);
    const avgPrice = items.reduce((sum, item) => sum + parseFloat(item.sell_price || 0), 0) / totalItems;

    // Update the UI
    $('#totalItems').text(totalItems);
    $('#totalStock').text(totalStock);
    $('#totalValue').text(`₱${totalValue.toFixed(2)}`);
    $('#avgPrice').text(`₱${avgPrice.toFixed(2)}`);
}

/**
 * Setup event listeners
 */
function setupEventListeners() {
    // Search form submission
    $('#searchForm').on('submit', function(e) {
        e.preventDefault();
        applyFilters();
    });

    // Reset filters
    $('#resetFilters').on('click', function() {
        $('#searchForm')[0].reset();
        itemsTable.search('').columns().search('').draw();
    });
}

/**
 * Apply filters to the datatable
 */
function applyFilters() {
    const searchTerm = $('#searchInput').val().trim();
    const categoryFilter = $('#categoryFilter').val();
    const minPrice = $('#minPrice').val();
    const maxPrice = $('#maxPrice').val();
    const stockStatus = $('#stockStatus').val();

    // Apply search term to all searchable columns
    itemsTable.search(searchTerm).draw();
    
    // Apply column filters
    itemsTable.column(7).search(categoryFilter); // Category column
    
    // Apply price range filter
    $.fn.dataTable.ext.search.push(
        function(settings, data, dataIndex) {
            const price = parseFloat(data[5].replace(/[^0-9.-]+/g,"")) || 0;
            const min = minPrice ? parseFloat(minPrice) : 0;
            const max = maxPrice ? parseFloat(maxPrice) : Number.MAX_VALUE;
            return price >= min && price <= max;
        }
    );
    
    // Apply stock status filter
    if (stockStatus) {
        $.fn.dataTable.ext.search.push(
            function(settings, data, dataIndex) {
                const stock = parseInt(data[6]) || 0;
                if (stockStatus === 'in_stock') return stock > 0;
                if (stockStatus === 'low_stock') return stock > 0 && stock <= 10;
                if (stockStatus === 'out_of_stock') return stock === 0;
                return true;
            }
        );
    }
    
    // Redraw the table with filters applied
    itemsTable.draw();
    
    // Clean up the search array
    $.fn.dataTable.ext.search.pop();
    if (stockStatus) $.fn.dataTable.ext.search.pop();
}

/**
 * Load categories for filter dropdown
 */
function loadCategories() {
    const token = localStorage.getItem('token');
    
    $.ajax({
        url: `${config.apiBaseUrl}${config.endpoints.categories}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        },
        success: function(response) {
            if (response && response.data) {
                const $select = $('#categoryFilter');
                $select.empty().append('<option value="">All Categories</option>');
                
                response.data.forEach(category => {
                    $select.append(`<option value="${category.description}">${category.description}</option>`);
                });
            }
        },
        error: function(xhr, status, error) {
            console.error('Error loading categories:', error);
        }
    });
}

// Make functions available globally
window.refreshItemsTable = function() {
    if (itemsTable) {
        itemsTable.ajax.reload();
    }
};

window.deleteItem = function(itemId) {
    const token = localStorage.getItem('token');
    
    Swal.fire({
        title: 'Are you sure?',
        text: 'This will move the item to trash.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#d33',
        confirmButtonText: 'Yes, delete it!'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `${config.apiBaseUrl}/item/admin/${itemId}`,
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                success: function(response) {
                    Swal.fire(
                        'Deleted!',
                        'The item has been moved to trash.',
                        'success'
                    );
                    refreshItemsTable();
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.message || 'Failed to delete item';
                    Swal.fire('Error!', errorMsg, 'error');
                }
            });
        }
    });
};

window.restoreItem = function(itemId) {
    const token = localStorage.getItem('token');
    
    Swal.fire({
        title: 'Restore Item?',
        text: 'This will restore the item from trash.',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#28a745',
        cancelButtonColor: '#6c757d',
        confirmButtonText: 'Yes, restore it!'
    }).then((result) => {
        if (result.isConfirmed) {
            $.ajax({
                url: `${config.apiBaseUrl}/item/admin/restore/${itemId}`,
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                success: function(response) {
                    Swal.fire(
                        'Restored!',
                        'The item has been restored.',
                        'success'
                    );
                    refreshItemsTable();
                },
                error: function(xhr) {
                    const errorMsg = xhr.responseJSON?.message || 'Failed to restore item';
                    Swal.fire('Error!', errorMsg, 'error');
                }
            });
        }
    });
};

window.editItem = function(itemId) {
    window.location.href = `edit-item.html?id=${itemId}`;
};
