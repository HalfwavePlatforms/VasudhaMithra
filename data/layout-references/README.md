# Government Land Record Layout References (Blank / Specimen Templates)

This directory documents layout structures, field placement, and terminology from official Indian land governance portals (DILRMP). These references are used solely to calibrate the synthetic document generator's visual hierarchy and field coordinates. No personal citizen data is stored.

## Public Specimen Reference Sources (Accessed: 2026-09-03)

### 1. Madhya Pradesh — MP Bhulekh (Khasra & Khatauni Formats)
- **Portal URL**: https://mpbhulekh.gov.in
- **Form Category**: Khasra Nakal (खसरा नकल) / B-1 Kistbandi Khatauni
- **Header Structure**: `मध्य प्रदेश शासन - राजस्व विभाग: अधिकार अभिलेख (खसरा / बी-१)`
- **Key Fields**:
  - सर्वे क्र (Survey No) / खसरा क्र (Khasra No)
  - खाता क्र (Khata No)
  - भूमि स्वामी / खातेदार का नाम (Landowner Name)
  - क्षेत्रफल (Area / Extent in Hectare / Acre)
  - ग्राम (Village), तहसील (Tehsil), जिला (District)
  - भू-राजस्व / भूमि प्रकार (Land Classification)

### 2. Karnataka — Bhoomi Portal (RTC / Pahani Form 16)
- **Portal URL**: https://landrecords.karnataka.gov.in / https://bhoomi.karnataka.gov.in
- **Form Category**: RTC (Record of Rights, Tenancy and Crops) / Pahani (Form 16) & Mutation Register (Form 12)
- **Header Structure**: `ಕರ್ನಾಟಕ ಸರ್ಕಾರ - ಕಂದಾಯ ಇಲಾಖೆ: ಪಹಣಿ / ಆರ್‌ಟಿಸಿ (ನಮೂನೆ ೧೬)`
- **Key Fields**:
  - ಸರ್ವೆ ನಂ (Survey No) & ಹಿಸ್ಸಾ ನಂ (Hissa No)
  - ಖಾತಾ ನಂ (Khata No)
  - ಖಾತೇದಾರರ ಹೆಸರು (Khatedar / Owner Name)
  - ವಿಸ್ತೀರ್ಣ (Area Extent in Acre / Gunta)
  - ಗ್ರಾಮ (Village), ತಾಲೂಕು (Taluk), ಜಿಲ್ಲೆ (District)
  - ಮ್ಯುಟೇಶನ್ ನಂ (Mutation Ref No - ನಮೂನೆ ೧೨)

### 3. Uttar Pradesh — UP Bhulekh (Khatauni & RoR Formats)
- **Portal URL**: https://upbhulekh.gov.in
- **Form Category**: RoR Khatauni (अधिकार अभिलेख खतौनी)
- **Header Structure**: `उत्तर प्रदेश राजस्व परिषद - खतौनी (अधिकार अभिलेख)`
- **Key Fields**:
  - फसली वर्ष (Fasli Year)
  - ग्राम / परगना / तहसील / जनपद (Village / Pargana / Tehsil / District)
  - खाता संख्या (Khata Number)
  - खसरा संख्या (Khasra Number)
  - खातेदार का नाम एवं पिता का नाम (Owner Name & Parentage)
  - क्षेत्रफल (हेक्टेयर) (Area in Hectare)

### 4. West Bengal, Tamil Nadu & Telangana State References
- **Banglarbhumi (WB)**: https://banglarbhumi.gov.in — দাগ নং (Dag No), খতিয়ান নং (Khatian No), রায়তের নাম (Rayat Name), মৌজা (Mouza)
- **AnyROR / e-Patta (TN)**: https://eservices.tn.gov.in — பட்டா எண் (Patta No), சர்வே எண் (Survey No), கிராமம் (Village), வட்டம் (Taluk)
- **Meebhoomi (AP/TG)**: https://meebhoomi.ap.gov.in — సర్వే నంబరు (Survey No), ఖాతా నంబరు (Khata No), పట్టాదారు (Pattadar)