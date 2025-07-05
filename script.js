// --- FUNCIÓN PRINCIPAL ---
function realizarAnalisis() {
    try {
        // 1. Obtener todos los valores del formulario
        const inputs = {
            capex: parseFloat(document.getElementById('capex').value),
            opex: parseFloat(document.getElementById('opex').value),
            beneficioAnual: parseFloat(document.getElementById('beneficioAnual').value),
            vidaUtil: parseInt(document.getElementById('vidaUtil').value),
            valorRescate: parseFloat(document.getElementById('valorRescate').value),
            tasaDescuento: parseFloat(document.getElementById('tasaDescuento').value) / 100,
            tasaImpuesto: parseFloat(document.getElementById('tasaImpuesto').value) / 100,
        };

        if (Object.values(inputs).some(isNaN)) {
            alert("Error: Por favor, rellene todos los campos con valores numéricos válidos.");
            return;
        }

        // 2. Construir el flujo de caja base
        const flujoDeCaja = construirFlujoDeCaja(inputs);

        // 3. Calcular los indicadores clave
        const vpn = calcularVPN(inputs.tasaDescuento, flujoDeCaja);
        const tir = calcularTIR(flujoDeCaja);
        const payback = calcularPaybackDescontado(inputs.tasaDescuento, flujoDeCaja);

        // 4. Realizar análisis de sensibilidad
        const resultadosSensibilidad = analizarSensibilidad(inputs);

        // 5. Mostrar todos los resultados
        mostrarResultados(vpn, tir, payback, resultadosSensibilidad);

    } catch (error) {
        alert("Ha ocurrido un error inesperado durante el cálculo. Por favor, revisa que todos los datos introducidos sean correctos.\n\nDetalle del error: " + error.message);
    }
}


// --- FUNCIONES DE CÁLCULO ---

function construirFlujoDeCaja(params) {
    const { capex, opex, beneficioAnual, vidaUtil, valorRescate, tasaImpuesto } = params;
    const depreciacionAnual = capex / vidaUtil;
    const flujos = [];
    flujos.push(-capex);

    const utilidadAntesImpuestos = beneficioAnual - opex - depreciacionAnual;
    const utilidadNeta = utilidadAntesImpuestos * (1 - tasaImpuesto);
    const fco = utilidadNeta + depreciacionAnual;

    for (let i = 0; i < vidaUtil; i++) {
        flujos.push(fco);
    }

    const gananciaVenta = valorRescate - 0;
    const impuestoSobreVenta = gananciaVenta * tasaImpuesto;
    const flujoNetoPorVenta = valorRescate - impuestoSobreVenta;
    flujos[vidaUtil] += flujoNetoPorVenta;

    return flujos;
}

function calcularVPN(tasa, flujos) {
    let vpn = flujos[0];
    for (let i = 1; i < flujos.length; i++) {
        vpn += flujos[i] / Math.pow(1 + tasa, i);
    }
    return vpn;
}

function calcularTIR(flujos, intentos = 100) {
    const umbral = 0.001;
    let tasaBaja = -0.99;
    let tasaAlta = 1.0;

    for (let i = 0; i < intentos; i++) {
        let tasaMedia = (tasaBaja + tasaAlta) / 2;
        let vpn = calcularVPN(tasaMedia, flujos);

        if (Math.abs(vpn) < umbral) {
            return tasaMedia;
        }

        if (vpn > 0) {
            tasaBaja = tasaMedia;
        } else {
            tasaAlta = tasaMedia;
        }
    }
    return null;
}

function calcularPaybackDescontado(tasa, flujos) {
    let flujoAcumulado = flujos[0];
    if (flujoAcumulado >= 0) return 0;
    for (let i = 1; i < flujos.length; i++) {
        const flujoDescontado = flujos[i] / Math.pow(1 + tasa, i);
        if (flujoAcumulado + flujoDescontado >= 0) {
            const porcionAno = -flujoAcumulado / flujoDescontado;
            return i - 1 + porcionAno;
        }
        flujoAcumulado += flujoDescontado;
    }
    return null;
}

// --- ANÁLISIS DE SENSIBILIDAD ---
function analizarSensibilidad(baseInputs) {
    const variables = [
        { nombre: "Inversión (CAPEX)", clave: 'capex' },
        { nombre: "Beneficio Anual (ΔALE)", clave: 'beneficioAnual' },
        { nombre: "Tasa de Descuento", clave: 'tasaDescuento' }
    ];
    const variacion = 0.20;
    const resultados = [];
    const baseFlujoDeCaja = construirFlujoDeCaja(baseInputs);
    const vpnBase = calcularVPN(baseInputs.tasaDescuento, baseFlujoDeCaja);

    variables.forEach(v => {
        let vpnBajo, vpnAlto;
        const valorOriginal = baseInputs[v.clave];
        const inputsBajo = { ...baseInputs, [v.clave]: valorOriginal * (1 - variacion) };
        const inputsAlto = { ...baseInputs, [v.clave]: valorOriginal * (1 + variacion) };

        if (v.clave === 'tasaDescuento') {
            vpnBajo = calcularVPN(inputsBajo.tasaDescuento, baseFlujoDeCaja);
            vpnAlto = calcularVPN(inputsAlto.tasaDescuento, baseFlujoDeCaja);
        } else {
            const flujoBajo = construirFlujoDeCaja(inputsBajo);
            const flujoAlto = construirFlujoDeCaja(inputsAlto);
            vpnBajo = calcularVPN(baseInputs.tasaDescuento, flujoBajo);
            vpnAlto = calcularVPN(baseInputs.tasaDescuento, flujoAlto);
        }
        
        resultados.push({ variable: v.nombre, vpnBajo, vpnBase, vpnAlto });
    });
    
    return resultados;
}

// --- FUNCIONES DE VISUALIZACIÓN ---
function mostrarResultados(vpn, tir, payback, sensibilidad) {
    const resultadosDiv = document.getElementById('resultados');
    resultadosDiv.classList.remove('hidden');
    
    /**
     * FUNCIÓN DE FORMATO CORREGIDA Y UNIVERSAL
     * Esta función manual no depende de las características del navegador.
     */
    const formatoMoneda = (valor) => {
        if (valor === null || isNaN(valor)) return 'N/A';
        const signo = valor < 0 ? "-$" : "$";
        // Usamos toFixed(2) para asegurar dos decimales
        const [parteEntera, parteDecimal] = Math.abs(valor).toFixed(2).split('.');
        // Usamos una expresión regular para añadir los puntos como separadores de miles
        const enteroConSeparadores = parteEntera.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
        return `${signo}${enteroConSeparadores},${parteDecimal}`;
    };

    document.getElementById('resultado-vpn').innerHTML = `<h3>Valor Presente Neto (VPN)</h3><p>${formatoMoneda(vpn)}</p>`;
    document.getElementById('resultado-tir').innerHTML = `<h3>Tasa Interna de Retorno (TIR)</h3><p>${tir ? (tir * 100).toFixed(2) + '%' : 'No aplicable'}</p>`;
    document.getElementById('resultado-payback').innerHTML = `<h3>Payback Descontado</h3><p>${payback ? payback.toFixed(2) + ' años' : 'No se recupera'}</p>`;

    let tablaHTML = `
        <table>
            <thead><tr><th>Variable Analizada</th><th>VPN (Bajo -20%)</th><th>VPN (Base)</th><th>VPN (Alto +20%)</th></tr></thead>
            <tbody>`;
    sensibilidad.forEach(r => {
        tablaHTML += `<tr>
            <td>${r.variable}</td>
            <td>${formatoMoneda(r.vpnBajo)}</td>
            <td>${formatoMoneda(r.vpnBase)}</td>
            <td>${formatoMoneda(r.vpnAlto)}</td>
        </tr>`;
    });
    tablaHTML += '</tbody></table>';
    document.getElementById('sensibilidad-container').innerHTML = tablaHTML;
}