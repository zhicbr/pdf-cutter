const { PDFDocument } = PDFLib;

const fileUpload = document.getElementById('file-upload');
const dropZone = document.getElementById('drop-zone');
const fileNameSpan = document.getElementById('file-name');
const dropHint = document.getElementById('drop-hint');
const startPageInput = document.getElementById('start-page');
const endPageInput = document.getElementById('end-page');
const splitButton = document.getElementById('split-button');
const statusDiv = document.getElementById('status');

let pdfFile = null;

function handleFile(file) {
    if (file && file.type === 'application/pdf') {
        pdfFile = file;
        fileNameSpan.textContent = file.name;
        dropHint.textContent = '已选择文件：';
        splitButton.disabled = false;
    } else {
        pdfFile = null;
        fileNameSpan.textContent = '';
        dropHint.textContent = file ? '请选择PDF文件' : '将PDF文件拖拽到此处，或点击选择文件';
        splitButton.disabled = true;
    }
}

dropZone.addEventListener('click', () => fileUpload.click());

fileUpload.addEventListener('change', (event) => {
    handleFile(event.target.files[0]);
});

dropZone.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropZone.classList.add('border-blue-600', 'bg-blue-200');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('border-blue-600', 'bg-blue-200');
});

dropZone.addEventListener('drop', (event) => {
    event.preventDefault();
    dropZone.classList.remove('border-blue-600', 'bg-blue-200');
    const file = event.dataTransfer.files[0];
    handleFile(file);
});

splitButton.addEventListener('click', async () => {
    if (!pdfFile) {
        statusDiv.textContent = '请先选择一个PDF文件！';
        statusDiv.style.color = 'red';
        return;
    }

    const startPage = parseInt(startPageInput.value);
    const endPage = parseInt(endPageInput.value);

    if (isNaN(startPage) || isNaN(endPage) || startPage <= 0 || endPage <= 0 || startPage > endPage) {
        statusDiv.textContent = '请输入有效的起始和结束页码！';
        statusDiv.style.color = 'red';
        return;
    }

    statusDiv.textContent = '正在处理中...';
    statusDiv.style.color = 'blue';

    try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        const pdfDoc = await PDFDocument.load(arrayBuffer);

        const totalPages = pdfDoc.getPageCount();
        if (endPage > totalPages) {
            statusDiv.textContent = `错误：PDF总共只有 ${totalPages} 页。`;
            statusDiv.style.color = 'red';
            return;
        }

        const newPdfDoc = await PDFDocument.create();
        const pageIndices = Array.from({ length: endPage - startPage + 1 }, (_, i) => startPage + i - 1);
        
        const copiedPages = await newPdfDoc.copyPages(pdfDoc, pageIndices);
        copiedPages.forEach((page) => {
            newPdfDoc.addPage(page);
        });

        const pdfBytes = await newPdfDoc.save();

        const blob = new Blob([pdfBytes], { type: 'application/pdf' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `split_${pdfFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        statusDiv.textContent = '切割完成并已开始下载！';
        statusDiv.style.color = 'green';

    } catch (error) {
        console.error(error);
        statusDiv.textContent = '处理PDF时发生错误。';
        statusDiv.style.color = 'red';
    }
});