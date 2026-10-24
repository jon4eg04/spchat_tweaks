// Minimal ZIP reader for local Tampermonkey backups. No code is executed.
const MAX_ARCHIVE = 128 * 1024 * 1024;
const MAX_ENTRY = 64 * 1024 * 1024;
const MAX_TOTAL = 128 * 1024 * 1024;
const decoder = new TextDecoder('utf-8', { fatal: true });

export function crc32(bytes) {
    let crc = 0xffffffff;
    for (const byte of bytes) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
    }
    return (crc ^ 0xffffffff) >>> 0;
}

export async function readZip(bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length > MAX_ARCHIVE) throw new Error('Архив больше 128 МБ. Экспортируй только нужные скрипты.');
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const ensure = (offset, size) => {
        if (!Number.isSafeInteger(offset) || offset < 0 || offset + size > bytes.length) {
            throw new Error('Архив ZIP повреждён или обрезан.');
        }
    };
    let end = -1;
    for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
        if (view.getUint32(i, true) === 0x06054b50 && i + 22 + view.getUint16(i + 20, true) === bytes.length) {
            end = i; break;
        }
    }
    if (end < 0) throw new Error('Не найден ZIP-архив. Выбери резервную копию Tampermonkey.');
    const count = view.getUint16(end + 10, true);
    const size = view.getUint32(end + 12, true);
    let offset = view.getUint32(end + 16, true);
    if (view.getUint16(end + 4, true) || view.getUint16(end + 6, true)
        || count !== view.getUint16(end + 8, true) || count === 65535
        || offset === 0xffffffff || size === 0xffffffff) throw new Error('ZIP64 и многотомные архивы не поддерживаются.');
    ensure(offset, size);
    const directoryEnd = offset + size;
    if (directoryEnd > end) throw new Error('Некорректный каталог ZIP.');
    const files = new Map();
    let total = 0;
    for (let index = 0; index < count; index++) {
        ensure(offset, 46);
        if (view.getUint32(offset, true) !== 0x02014b50) throw new Error('Некорректная запись ZIP.');
        const flags = view.getUint16(offset + 8, true);
        const method = view.getUint16(offset + 10, true);
        const crc = view.getUint32(offset + 16, true);
        const compressedSize = view.getUint32(offset + 20, true);
        const originalSize = view.getUint32(offset + 24, true);
        const nameLength = view.getUint16(offset + 28, true);
        const extraLength = view.getUint16(offset + 30, true);
        const commentLength = view.getUint16(offset + 32, true);
        const local = view.getUint32(offset + 42, true);
        ensure(offset + 46, nameLength + extraLength + commentLength);
        const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
        offset += 46 + nameLength + extraLength + commentLength;
        if (offset > directoryEnd) throw new Error('Каталог ZIP выходит за границы.');
        if (!/\.(?:user\.js|storage\.json|options\.json)$/.test(name)) continue;
        if (files.has(name)) throw new Error('Архив содержит повторяющиеся имена файлов.');
        if (flags & 1) throw new Error('Зашифрованный ZIP не поддерживается.');
        if (originalSize > MAX_ENTRY || (total += originalSize) > MAX_TOTAL) {
            throw new Error('В архиве слишком много данных. Экспортируй только скрипты SpicyChat.');
        }
        ensure(local, 30);
        if (view.getUint32(local, true) !== 0x04034b50) throw new Error('Повреждён заголовок файла ZIP.');
        if (view.getUint16(local + 8, true) !== method || (view.getUint16(local + 6, true) & 1)) {
            throw new Error('Несогласованные заголовки ZIP.');
        }
        const dataOffset = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
        ensure(dataOffset, compressedSize);
        if (dataOffset + compressedSize > directoryEnd - size) throw new Error('Данные ZIP перекрывают каталог.');
        const compressed = bytes.subarray(dataOffset, dataOffset + compressedSize);
        let content;
        if (method === 0) content = compressed;
        else if (method === 8) {
            let stream;
            try { stream = new DecompressionStream('deflate-raw'); }
            catch { throw new Error('Для импорта ZIP нужен актуальный Firefox или Chrome.'); }
            const reader = new Blob([compressed]).stream().pipeThrough(stream).getReader();
            const chunks = [];
            let length = 0;
            try {
                while (true) {
                    const { value, done } = await reader.read();
                    if (done) break;
                    length += value.length;
                    if (length > originalSize || length > MAX_ENTRY) {
                        await reader.cancel();
                        throw new Error('Распакованный файл превышает заявленный размер.');
                    }
                    chunks.push(value);
                }
            } finally { reader.releaseLock(); }
            content = new Uint8Array(length);
            let position = 0;
            for (const chunk of chunks) { content.set(chunk, position); position += chunk.length; }
        } else throw new Error('Неподдерживаемое сжатие ZIP. Используй штатный экспорт Tampermonkey.');
        if (content.length !== originalSize || crc32(content) !== crc) throw new Error('Проверка целостности ZIP не пройдена.');
        files.set(name, decoder.decode(content));
    }
    return files;
}
