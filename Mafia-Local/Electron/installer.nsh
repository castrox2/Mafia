!macro customInstall
  SetShellVarContext current
  IfFileExists "$INSTDIR\resources\Mafia-Icon.ico" 0 +3
    CreateShortCut "$DESKTOP\Mafia Local.lnk" "$INSTDIR\Mafia Local.exe" "" "$INSTDIR\resources\Mafia-Icon.ico" 0
    CreateShortCut "$SMPROGRAMS\Mafia Local.lnk" "$INSTDIR\Mafia Local.exe" "" "$INSTDIR\resources\Mafia-Icon.ico" 0
!macroend
