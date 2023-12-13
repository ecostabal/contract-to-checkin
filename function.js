const axios = require('axios');

// Apikey (Replace 'YOUR_API_KEY' with your Monday.com API key)
const apiKey = 'eyJhbGciOiJIUzI1NiJ9.eyJ0aWQiOjIzMjg3MzUyNCwiYWFpIjoxMSwidWlkIjoyMzUzNzM2NCwiaWFkIjoiMjAyMy0wMS0zMVQyMTowMjoxNy4wMDBaIiwicGVyIjoibWU6d3JpdGUiLCJhY3RpZCI6OTUwNzUxNiwicmduIjoidXNlMSJ9.lX1RYu90B2JcH0QxITaF8ymd4d6dBes0FJHPI1mzSRE';

// Function to get the data of an item from Monday.com
async function getMondayItemData(itemId) {
    try {
        const query = `
            query {
                items(ids: [${itemId}]) {
                    column_values {
                        id
                        text
                        value
                    }
                    subitems {
                        column_values {
                            id
                            text
                            value
                        }
                    }
                }
            }
        `;

        const response = await axios.post('https://api.monday.com/v2', { query }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.data && response.data.data.items && response.data.data.items.length > 0) {
            const itemData = response.data.data.items[0];
            console.log('Data of item and its subitems retrieved successfully:', itemData);

            const columnsData = itemData.column_values;
            const subitemsData = itemData.subitems;

            console.log('Columns of the Item:', JSON.stringify(columnsData, null, 2));
            console.log('Subitems:', JSON.stringify(subitemsData, null, 2));

            return { columnsData, subitemsData };
        } else {
            console.error('No items found for the given ID:', itemId);
            return {};
        }
    } catch (error) {
        console.error('Error occurred while retrieving the data of the item:', error);
        throw error;
    }
}

// Function to process subitems and create new items
async function processSubElementsAndCreateItems(boardId, itemId) {
    try {
        console.log('Starting processing of subitems and creation of new items for the item:', itemId);

        const itemData = await getMondayItemData(itemId);
        if (!itemData || Object.keys(itemData).length === 0 || !itemData.columnsData) {
            console.error('No columns data found for the item with ID:', itemId);
            return;
        }

        const { columnsData, subitemsData } = itemData;

        // Verificar si el tipo de contrato es "Arriendo"
        const contractTypeColumn = columnsData.find(cv => cv.id === 'estado_1');
        if (!contractTypeColumn || contractTypeColumn.text !== 'Arriendo') {
            console.log('Tipo de contrato no es Arriendo. Saliendo del proceso.');
            return;
        }

        let formattedLocation = '';
        const locationColumn = columnsData.find(cv => cv.id === 'ubicaci_n');
        if (locationColumn && locationColumn.text) {
            const locationData = JSON.parse(locationColumn.value);
            if (locationData && 'lat' in locationData && 'lng' in locationData) {
                formattedLocation = `${locationData.lat} ${locationData.lng}`;
                console.log('Processing location data:', locationColumn);
                address = locationData.address;
                console.log('Processing address:', address);
                if (locationData.address) {
                    formattedLocation += ` ${locationData.address}`;
                }
            }
        }

        if (!Array.isArray(subitemsData) || subitemsData.length === 0) {
            console.log('No subitems to process for this item.');
            return;
        }


        for (const subitem of subitemsData) {
            const subitemColumns = subitem.column_values;
            console.log('Subitem column values:', JSON.stringify(subitemColumns, null, 2));
            const signerTypeColumn = subitemColumns.find(column => column.id === 'reflejo_189');

            if (signerTypeColumn && (signerTypeColumn.text === 'Arrendatario')) {
                const name = subitemColumns.find(column => column.id === 'reflejo0')?.text || '';
                const lastName = subitemColumns.find(column => column.id === 'reflejo')?.text || '';
                const id = subitemColumns.find(column => column.id === 'reflejo_1')?.text || '';
                const phone = subitemColumns.find(column => column.id === 'reflejo_2')?.text || '';
                const email = subitemColumns.find(column => column.id === 'reflejo_3')?.text || '';
                const comisionRate = subitemColumns.find(column => column.id === 'n_meros7')?.text || '';
                const razonSocial = subitemColumns.find(column => column.id === 'texto2')?.text || '';
                const rutRazonSocial = subitemColumns.find(column => column.id === 'texto1')?.text
                const fullName = `${name} ${lastName}`;

                const contractType = columnsData.find(cv => cv.id === 'estado_1')?.text || '';
                const propertyType = columnsData.find(cv => cv.id === 'estado_17')?.text || '';
                const unitNumber = columnsData.find(cv => cv.id === 'texto')?.text || '';
                const parkingSpaces = columnsData.find(cv => cv.id === 'texto4')?.text || '';
                const storageUnits = columnsData.find(cv => cv.id === 'texto2')?.text || '';
                const rentalValue = columnsData.find(cv => cv.id === 'n_meros')?.text || '';
                const notaryFee = columnsData.find(cv => cv.id === 'n_meros5')?.text || '';

                const newItemName = `Check-in Propiedad: ${address}`;
                const newItemData = {
                    texto: name,
                    texto1: lastName,
                    texto7: id,
                    texto5: razonSocial,
                    texto30: rutRazonSocial,
                    tel_fono: phone,
                    correo_electr_nico: { email: email, text: email },
                    ubicaci_n: formattedLocation,
                    texto3: unitNumber,
                    texto8: parkingSpaces,
                    texto70: storageUnits,
                    estado_1: propertyType,
                };

                const newItemId = await createNewItemInOtherBoard(boardId, newItemName, newItemData, formattedLocation);
                console.log('Processed subitem:', signerTypeColumn.text, '- New item created with ID:', newItemId);
            }
        }
    } catch (error) {
        console.error('Error occurred while processing subitems and creating new items:', error);
        throw error;
    }
}

// Function to create a new item in a different board
async function createNewItemInOtherBoard(boardId, name, data, formattedLocation) {
    try {
        // Convertir los datos de las columnas a un string JSON para la mutación
        const columnValues = JSON.stringify(data);

        // Crear la mutación GraphQL
        const mutation = `
            mutation createItem($boardId: Int!, $itemName: String!, $columnValues: JSON!) {
                create_item (board_id: $boardId, item_name: $itemName, column_values: $columnValues) {
                    id
                }
            }
        `;

        // Variables para la mutación
        const variables = {
            boardId: boardId,
            itemName: name,
            columnValues: columnValues
        };

        console.log('Creating new item with data:', columnValues);
        const response = await axios.post('https://api.monday.com/v2', {
            query: mutation,
            variables: variables
        }, {
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('API response for new item creation:', response.data);
        if (response.data && response.data.data && response.data.data.create_item && response.data.data.create_item.id) {
            const newItemId = response.data.data.create_item.id;
            console.log('New item created with ID:', newItemId);
            return newItemId;
        } else {
            console.error('Failed to create new item. API response:', response.data);
            throw new Error('Failed to create new item');
        }
    } catch (error) {
        console.error('Error occurred while creating a new item:', error);
        if (error.response) {
            console.error('Error response:', error.response.data);
            console.error('Status:', error.response.status);
        }
        throw error;
    }
}



exports.contractToCheckIn = async (req, res) => {
    try {
        console.log('Starting the function');

        if (!req.body) {
            throw new Error('The request does not contain data in the body');
        }

        if (!req.body.event || !req.body.event.pulseId) {
            throw new Error('The request does not contain the expected structure of a Monday.com event');
        }

        const boardId = 5579455685;
        const itemId = req.body.event.pulseId;

        await processSubElementsAndCreateItems(boardId, itemId);

        res.status(200).send('Subitems processed and new items created successfully');
    } catch (error) {
        console.error('Error in the main function:', error.message);
        res.status(400).send('Error in the request: ' + error.message);
    }
};