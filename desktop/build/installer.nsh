; Pantalla de mantenimiento: si Gnomore Gnomes ya está instalado, el instalador pregunta Modificar / Reparar / Desinstalar
; (como los instaladores habituales) y el desinstalador ofrece borrar también los datos del juego.
; Español si Windows está en español; inglés en el resto de casos.

!macro ggLang
  System::Call 'kernel32::GetUserDefaultUILanguage() i.r9'
  IntOp $9 $9 & 0x3FF
  ${If} $9 == 10
    StrCpy $ggEs 1
  ${Else}
    StrCpy $ggEs 0
  ${EndIf}
!macroend
!macro ggT VAR ES EN
  ${If} $ggEs == 1
    StrCpy ${VAR} "${ES}"
  ${Else}
    StrCpy ${VAR} "${EN}"
  ${EndIf}
!macroend

!include nsDialogs.nsh
!include LogicLib.nsh
!include WinMessages.nsh
!ifndef BUILD_UNINSTALLER
  !include StrContains.nsh
!endif
Var ggEs
Var ggBold
!ifndef BUILD_UNINSTALLER
  Var ggMode
  Var ggUnCmd
  Var ggVer
  Var ggDir
  Var ggRb1
  Var ggRb2
  Var ggRb3
!else
  Var ggCb
  Var ggDeleteData
!endif

!ifndef BUILD_UNINSTALLER
; ---------------------------------------------------------------- INSTALADOR
!macro customWelcomePage
  Function ggMaintPre
    ${If} ${Silent}
    ${OrIf} ${UAC_IsInnerInstance}
    ${OrIf} ${isUpdated}
      Abort
    ${EndIf}
    ReadRegStr $ggUnCmd SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    ${If} $ggUnCmd == ""
      Abort
    ${EndIf}
  FunctionEnd

  Function ggMaintCreate
    Call ggMaintPre
    !insertmacro ggLang
    ReadRegStr $ggVer SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "DisplayVersion"
    ReadRegStr $ggDir SHELL_CONTEXT "${INSTALL_REGISTRY_KEY}" "InstallLocation"
    ${If} $ggDir == ""
      StrCpy $ggDir "$INSTDIR"
    ${EndIf}
    !insertmacro ggT $R0 "${PRODUCT_NAME} ya está instalado" "${PRODUCT_NAME} is already installed"
    !insertmacro ggT $R1 "Elige qué quieres hacer con la instalación existente." "Choose what you want to do with the existing installation."
    !insertmacro MUI_HEADER_TEXT "$R0" "$R1"
    nsDialogs::Create 1018
    Pop $R0
    ${If} $R0 == error
      Abort
    ${EndIf}
    !insertmacro ggT $R1 "Versión instalada: $ggVer$\r$\nCarpeta: $ggDir" "Installed version: $ggVer$\r$\nFolder: $ggDir"
    ${NSD_CreateLabel} 0 0 100% 22u "$R1"
    Pop $R0
    CreateFont $ggBold "$(^Font)" "$(^FontSize)" "700"

    !insertmacro ggT $R1 "Modificar" "Modify"
    ${NSD_CreateRadioButton} 0 30u 100% 10u "$R1"
    Pop $ggRb1
    ${NSD_AddStyle} $ggRb1 ${WS_GROUP}
    SendMessage $ggRb1 ${WM_SETFONT} $ggBold 0
    !insertmacro ggT $R1 "Cambiar la carpeta de instalación (los accesos directos se vuelven a crear)." "Change the installation folder (shortcuts are created again)."
    ${NSD_CreateLabel} 12u 41u 94% 16u "$R1"
    Pop $R0

    !insertmacro ggT $R1 "Reparar" "Repair"
    ${NSD_CreateRadioButton} 0 62u 100% 10u "$R1"
    Pop $ggRb2
    SendMessage $ggRb2 ${WM_SETFONT} $ggBold 0
    !insertmacro ggT $R1 "Vuelve a copiar los archivos del programa y los accesos directos. Conserva tus ajustes y tu progreso." "Copies the program files and shortcuts again. Keeps your settings and progress."
    ${NSD_CreateLabel} 12u 73u 94% 16u "$R1"
    Pop $R0

    !insertmacro ggT $R1 "Desinstalar" "Uninstall"
    ${NSD_CreateRadioButton} 0 94u 100% 10u "$R1"
    Pop $ggRb3
    SendMessage $ggRb3 ${WM_SETFONT} $ggBold 0
    !insertmacro ggT $R1 "Elimina ${PRODUCT_NAME} de este equipo." "Removes ${PRODUCT_NAME} from this computer."
    ${NSD_CreateLabel} 12u 105u 94% 16u "$R1"
    Pop $R0

    ${If} $ggMode == "mod"
      ${NSD_Check} $ggRb1
    ${ElseIf} $ggMode == "un"
      ${NSD_Check} $ggRb3
    ${Else}
      ${NSD_Check} $ggRb2
    ${EndIf}
    nsDialogs::Show
  FunctionEnd

  Function ggRunUninstaller
    ; $ggUnCmd = "C:\ruta\Uninstall X.exe" /currentuser  -> ruta y argumentos por separado (ExecShell pide elevación si hace falta)
    StrCpy $R5 1
    ggLoop:
      StrCpy $R6 "$ggUnCmd" 1 $R5
      ${If} $R6 == '"'
      ${OrIf} $R6 == ""
        Goto ggDone
      ${EndIf}
      IntOp $R5 $R5 + 1
      Goto ggLoop
    ggDone:
    IntOp $R7 $R5 - 1
    StrCpy $R2 "$ggUnCmd" $R7 1
    IntOp $R5 $R5 + 1
    StrCpy $R4 "$ggUnCmd" "" $R5
    ExecShell "open" "$R2" "$R4"
  FunctionEnd

  Function ggMaintLeave
    ${NSD_GetState} $ggRb1 $R0
    ${NSD_GetState} $ggRb3 $R1
    ${If} $R1 == ${BST_CHECKED}
      StrCpy $ggMode "un"
      ; Se abre el desinstalador (con su propia pantalla de confirmación) y este instalador se cierra.
      Call ggRunUninstaller
      Quit
    ${ElseIf} $R0 == ${BST_CHECKED}
      StrCpy $ggMode "mod"
    ${Else}
      StrCpy $ggMode "rep"
    ${EndIf}
  FunctionEnd
  Page custom ggMaintCreate ggMaintLeave
!macroend

; Al modificar o reparar, el modo (solo yo / todos los usuarios) ya se conoce de la instalación existente: se salta esa pantalla.
!macro customInstallMode
  ${If} $ggMode == "rep"
  ${OrIf} $ggMode == "mod"
    ${If} $hasPerMachineInstallation == "1"
      StrCpy $isForceMachineInstall "1"
    ${Else}
      StrCpy $isForceCurrentInstall "1"
    ${EndIf}
  ${EndIf}
!macroend

; La carpeta de instalación la gestionamos aquí (en vez de la opción de electron-builder) para poder saltarla al Reparar.
!macro customPageAfterChangeDir
  Function ggDirPre
    ${If} $ggMode == "rep"
    ${OrIf} ${isUpdated}
      Abort
    ${EndIf}
  FunctionEnd
  Function ggInstFilesPre
    ${StrContains} $0 "${APP_FILENAME}" $INSTDIR
    ${If} $0 == ""
      StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
    ${EndIf}
  FunctionEnd
  !define MUI_PAGE_CUSTOMFUNCTION_PRE ggDirPre
  !insertmacro MUI_PAGE_DIRECTORY
  !define MUI_PAGE_CUSTOMFUNCTION_PRE ggInstFilesPre
!macroend

!else
; ------------------------------------------------------------- DESINSTALADOR
!macro customUnWelcomePage
  Function un.ggUnCreate
    ${If} ${Silent}
    ${OrIf} ${isUpdated}
      Abort
    ${EndIf}
    !insertmacro ggLang
    !insertmacro ggT $R0 "Desinstalar ${PRODUCT_NAME}" "Uninstall ${PRODUCT_NAME}"
    !insertmacro ggT $R1 "Se va a quitar el juego de este equipo." "The game will be removed from this computer."
    !insertmacro MUI_HEADER_TEXT "$R0" "$R1"
    nsDialogs::Create 1018
    Pop $R0
    ${If} $R0 == error
      Abort
    ${EndIf}
    !insertmacro ggT $R1 "Se eliminarán el programa y sus accesos directos de:$\r$\n$INSTDIR" "The program and its shortcuts will be removed from:$\r$\n$INSTDIR"
    ${NSD_CreateLabel} 0 0 100% 24u "$R1"
    Pop $R0
    CreateFont $ggBold "$(^Font)" "$(^FontSize)" "700"
    !insertmacro ggT $R1 "Eliminar también los datos del juego" "Also delete the game data"
    ${NSD_CreateCheckbox} 0 36u 100% 10u "$R1"
    Pop $ggCb
    SendMessage $ggCb ${WM_SETFONT} $ggBold 0
    !insertmacro ggT $R1 "Borra las versiones descargadas, los ajustes y el progreso guardado en este equipo. Si tienes cuenta, tu progreso online no se pierde." "Deletes the downloaded versions, settings and progress saved on this computer. If you have an account, your online progress is kept."
    ${NSD_CreateLabel} 12u 47u 94% 24u "$R1"
    Pop $R0
    !insertmacro ggT $R1 "Podrás volver a instalar el juego cuando quieras desde la web." "You can install the game again at any time from the website."
    ${NSD_CreateLabel} 0 82u 100% 12u "$R1"
    Pop $R0
    GetDlgItem $R0 $HWNDPARENT 1
    !insertmacro ggT $R1 "Desinstalar" "Uninstall"
    SendMessage $R0 ${WM_SETTEXT} 0 "STR:$R1"
    nsDialogs::Show
  FunctionEnd
  Function un.ggUnLeave
    ${NSD_GetState} $ggCb $ggDeleteData
  FunctionEnd
  UninstPage custom un.ggUnCreate un.ggUnLeave
!macroend

!macro customUnInstall
  ${If} $ggDeleteData == ${BST_CHECKED}
    ${If} $installMode == "all"
      SetShellVarContext current
    ${EndIf}
    RMDir /r "$APPDATA\${APP_FILENAME}"
    !ifdef APP_PRODUCT_FILENAME
      RMDir /r "$APPDATA\${APP_PRODUCT_FILENAME}"
    !endif
    !ifdef APP_PACKAGE_NAME
      RMDir /r "$APPDATA\${APP_PACKAGE_NAME}"
    !endif
    ${If} $installMode == "all"
      SetShellVarContext all
    ${EndIf}
  ${EndIf}
!macroend
!endif
