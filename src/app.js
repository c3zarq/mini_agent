'use strict';

const { version } = require('../package.json');

function main() {
    console.log(`Mini Agent v${version}`);
    console.log('Aplicação inicializada com sucesso.');
}

if (require.main === module) {
    main();
}

module.exports = { main };
