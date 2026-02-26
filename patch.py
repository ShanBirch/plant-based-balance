import sys

filename = "lib/learning-inline.js"
with open(filename, "r", encoding="utf-8") as f:
    content = f.read()

old_text = "The hallmarks include: genomic instability (DNA damage accumulates), telomere attrition (protective chromosome caps shorten), epigenetic alterations (gene expression patterns drift), loss of proteostasis (protein quality control fails), deregulated nutrient sensing (cells respond poorly to nutrients), mitochondrial dysfunction (energy production declines), cellular senescence (damaged cells accumulate), stem cell exhaustion (regenerative capacity drops), and altered intercellular communication (cells miscommunicate)."
new_text = "The hallmarks include: genomic instability (DNA damage accumulates), telomere attrition (protective chromosome caps shorten), and epigenetic alterations (gene expression patterns drift).\n\nThey also include loss of proteostasis (protein quality control fails), deregulated nutrient sensing (cells respond poorly to nutrients), and mitochondrial dysfunction (energy production declines).\n\nFinally, cellular senescence (damaged cells accumulate), stem cell exhaustion (regenerative capacity drops), and altered intercellular communication (cells miscommunicate)."

if old_text in content:
    content = content.replace(old_text, new_text)
    with open(filename, "w", encoding="utf-8") as f:
        f.write(content)
    print("Success")
else:
    print("Not found")
