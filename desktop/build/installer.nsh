; Si el juego ya esta instalado, ofrece Reparar / Desinstalar en vez de reinstalar sin preguntar.
!macro customInit
  ${IfNot} ${Silent}
  ${IfNot} ${UAC_IsInnerInstance}
    ReadRegStr $R0 SHELL_CONTEXT "${UNINSTALL_REGISTRY_KEY}" "UninstallString"
    ${If} $R0 != ""
      System::Call 'kernel32::GetUserDefaultUILanguage() i.r1'
      IntOp $1 $1 & 0x3FF
      ${If} $1 == 10
        MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Gnomore Gnomes ya está instalado.$\r$\n$\r$\nSí  =  Reparar (reinstalar el juego)$\r$\nNo  =  Desinstalar$\r$\nCancelar  =  Salir" IDYES gg_repair IDNO gg_uninstall
      ${Else}
        MessageBox MB_YESNOCANCEL|MB_ICONQUESTION "Gnomore Gnomes is already installed.$\r$\n$\r$\nYes  =  Repair (reinstall the game)$\r$\nNo  =  Uninstall$\r$\nCancel  =  Exit" IDYES gg_repair IDNO gg_uninstall
      ${EndIf}
      Quit
      gg_uninstall:
        Exec '$R0'
        Quit
      gg_repair:
    ${EndIf}
  ${EndIf}
  ${EndIf}
!macroend
