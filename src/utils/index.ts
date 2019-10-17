import execa from 'execa';

export async function getInstalledPackages(cwd: string): Promise<{ [key: string]: string }> {
    const npmListCommandResult = (await execa('npm', ['list', '--depth=0', '--json'], { cwd, })).stdout;
    if (npmListCommandResult) {
        const jsonResult = JSON.parse(npmListCommandResult);
        const npmPackageList = jsonResult.dependencies
        if (npmPackageList) {
            const packages: { [key: string]: string } = {};
            Object.keys(npmPackageList).forEach(function (key) {
                packages[key] = npmPackageList[key].version;
            });

            return packages;
        }
    }
    return {};
}