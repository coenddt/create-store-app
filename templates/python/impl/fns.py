"""计算列回调实现（``fnRef → impl(item, ctx)``）。

定义文件（``schema/*.json``）只写 ``fnRef`` 字符串，函数实现必须落在这里，
由 ``impl/bootstrap.py`` 作为 ``fns`` 注入 ``create_app`` —— 定义可跨进程发布，
实现不可序列化。缺实现时启动即抛 ``ERR_FN_MISSING``（不静默）。
"""


def amount_label(doc, ctx=None):
    return f"{doc.get('amount', 0)} 元"


FNS = {"amountLabel": amount_label}
